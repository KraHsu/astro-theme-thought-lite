"""Reproducible experiments for RL notes 1-6. Python 3.10+, NumPy 1.26+.
Run: python ch1-6.py --output results.json
Optional plot: python ch1-6.py --output results.json --plot stochastic-approximation.png
States A,B,C,T; actions R,D; gamma=.9; reward 1 on entry to T, otherwise 0.
"""
import argparse
import itertools
import json
from pathlib import Path

import numpy as np

GAMMA = 0.9
NEXT = np.array([[1, 2], [1, 3], [3, 2], [3, 3]])
REWARD = ((NEXT == 3) & (np.arange(4)[:, None] != 3)).astype(float)
UNIFORM = np.full((4, 2), 0.5)
HORIZON = 200


def model(policy):
    transition = np.zeros((4, 4))
    for s in range(4):
        for a in range(2):
            transition[s, NEXT[s, a]] += policy[s, a]
    return transition, (policy * REWARD).sum(axis=1)


def evaluate(policy):
    transition, reward = model(policy)
    return np.linalg.solve(np.eye(4) - GAMMA * transition, reward)


def lookahead(value):
    return REWARD + GAMMA * value[NEXT]


def greedy(q):
    # R wins exact ties. This fixed rule prevents gratuitous policy cycling.
    return np.eye(2)[q.argmax(axis=1)]


def value_iteration(tol=1e-12):
    value = np.zeros(4)
    for sweeps in range(1, 10001):
        value = lookahead(value).max(axis=1)
        residual = np.max(np.abs(lookahead(value).max(axis=1) - value))
        if residual <= tol:
            return value, greedy(lookahead(value)), sweeps
    raise RuntimeError('Value iteration failed to converge')


def policy_iteration():
    policy = np.eye(2)[np.zeros(4, dtype=int)]
    for rounds in range(1, 101):
        value = evaluate(policy)
        improved = greedy(lookahead(value))
        if np.array_equal(improved, policy):
            return value, policy, rounds
        policy = improved
    raise RuntimeError('Policy iteration failed to stabilize')


def truncated_policy_iteration(sweeps=2, tol=1e-12):
    value = np.zeros(4)
    for rounds in range(1, 10001):
        policy = greedy(lookahead(value))
        transition, reward = model(policy)
        for _ in range(sweeps):
            value = reward + GAMMA * transition @ value
        if np.max(np.abs(lookahead(value).max(axis=1) - value)) <= tol:
            return value, greedy(lookahead(value)), rounds
    raise RuntimeError('Truncated policy iteration failed to converge')


def episode(policy, rng, start=0, first_action=None, horizon=HORIZON):
    """Discounted rollouts; a nonterminal horizon endpoint has zero tail estimate.
    For a return at time t, the missing tail is bounded by
    gamma**(horizon-t)/(1-gamma); truncated episodes are not discarded.
    """
    states, actions, rewards = [], [], []
    s = start
    for t in range(horizon):
        if s == 3:
            break
        a = first_action if t == 0 and first_action is not None else int(rng.random() >= policy[s, 0])
        states.append(s)
        actions.append(a)
        rewards.append(REWARD[s, a])
        s = int(NEXT[s, a])
    returns = np.zeros(len(rewards))
    total = 0.0
    for t in range(len(rewards) - 1, -1, -1):
        total = rewards[t] + GAMMA * total
        returns[t] = total
    return states, actions, returns, s == 3


def mc_prediction(seeds=range(10), counts=(100, 1000, 10000)):
    truth = evaluate(UNIFORM)
    errors = {n: [] for n in counts}
    max_sample_mean_error = 0.0
    for seed in seeds:
        rng = np.random.default_rng(seed)
        estimate, visits = np.zeros(4), np.zeros(4, dtype=int)
        sums = np.zeros(4)
        for n in range(1, max(counts) + 1):
            states, _, returns, terminated = episode(UNIFORM, rng)
            if not terminated:
                raise RuntimeError('Unexpected truncation in fixed-policy prediction')
            seen = set()
            # Forward scan is required for FIRST visit, although returns were computed backward.
            for s, total in zip(states, returns):
                if s in seen:
                    continue
                seen.add(s)
                visits[s] += 1
                estimate[s] += (total - estimate[s]) / visits[s]
                sums[s] += total
            if n in counts:
                assert np.all(visits[:3] > 0)
                errors[n].append(float(np.sqrt(np.mean((estimate[:3] - truth[:3]) ** 2))))
                max_sample_mean_error = max(max_sample_mean_error, float(np.max(np.abs(estimate[:3] - sums[:3] / visits[:3]))))
    assert max_sample_mean_error < 1e-12
    return {str(n): {'mean_state_rmse': float(np.mean(e)), 'std_across_seeds': float(np.std(e))} for n, e in errors.items()}


def mc_basic(seed, rounds=6, samples=300):
    rng = np.random.default_rng(seed)
    policy = UNIFORM.copy()
    truncated = 0
    for _ in range(rounds):
        q = np.zeros((4, 2))
        # Freeze the policy for the entire evaluation batch.
        for s in range(3):
            for a in range(2):
                totals = []
                for _ in range(samples):
                    _, _, returns, terminated = episode(policy, rng, s, a)
                    totals.append(returns[0])
                    truncated += int(not terminated)
                q[s, a] = np.mean(totals)
        policy = greedy(q)
    return policy, truncated, rounds * samples


def mc_control(seed, exploring_starts, episodes=10000, epsilon=0.2):
    rng = np.random.default_rng(seed)
    q, counts = np.zeros((4, 2)), np.zeros((4, 2), dtype=int)
    policy = UNIFORM.copy()
    truncated = 0
    for _ in range(episodes):
        start = int(rng.integers(3)) if exploring_starts else 0
        first = int(rng.integers(2)) if exploring_starts else None
        states, actions, returns, terminated = episode(policy, rng, start, first)
        truncated += int(not terminated)
        seen = set()
        for s, a, total in zip(states, actions, returns):
            if (s, a) in seen:
                continue
            seen.add((s, a))
            counts[s, a] += 1
            q[s, a] += (total - q[s, a]) / counts[s, a]
        policy = greedy(q)
        if not exploring_starts:
            policy = (1 - epsilon) * policy + epsilon / 2
    assert np.all(counts[:3] > 0), 'Every nonterminal pair should be sampled'
    return policy, greedy(q), truncated, int(counts[:3].min())


def stochastic_approximation(seeds=200, n=5000):
    """Exact return sampler for uniform-policy episodes starting at A.
    G=.9**K, P(K=k)=.5**k for k>=1. Same MDP as above.
    """
    mean = 9 / 11
    variance = 81 / 119 - mean ** 2
    checkpoints = sorted(set([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, n]))
    schedules = {'1/n': lambda k: 1 / k, 'constant 0.05': lambda k: 0.05, '1/(n+1)^2': lambda k: 1 / (k + 1) ** 2}
    curves = {name: np.zeros(len(checkpoints)) for name in schedules}
    final_means = {name: [] for name in schedules}
    for seed in range(seeds):
        rng = np.random.default_rng(1000 + seed)
        samples = GAMMA ** rng.geometric(0.5, size=n)
        for name, schedule in schedules.items():
            estimate, j = 0.0, 0
            for k, x in enumerate(samples, 1):
                estimate += schedule(k) * (x - estimate)
                if k == checkpoints[j]:
                    curves[name][j] += (estimate - mean) ** 2
                    if j < len(checkpoints) - 1:
                        j += 1
            final_means[name].append(estimate)
            if name == '1/n':
                assert abs(estimate - float(samples.mean())) < 1e-12
    report = {}
    for name in schedules:
        curves[name] = np.sqrt(curves[name] / seeds)
        report[name] = {'final_mean': float(np.mean(final_means[name])), 'final_rmse': float(curves[name][-1])}
    report['theory'] = {'return_mean': mean, 'return_variance': variance, 'sample_mean_rmse': float(np.sqrt(variance / n)), 'constant_step_asymptotic_rmse': float(np.sqrt(0.05 * variance / 1.95)), 'too_fast_expected_limit': mean / 2}
    return report, checkpoints, curves


def run():
    transition, reward = model(UNIFORM)
    assert np.all(transition >= 0) and np.allclose(transition.sum(axis=1), 1)
    exact = evaluate(UNIFORM)
    np.testing.assert_allclose(exact, [9 / 11, 10 / 11, 10 / 11, 0], atol=1e-12, rtol=0)
    value = np.zeros(4)
    for _ in range(1000):
        value = reward + GAMMA * transition @ value
    np.testing.assert_allclose(value, exact, atol=1e-12, rtol=0)
    np.testing.assert_allclose((UNIFORM * lookahead(exact)).sum(axis=1), exact, atol=1e-12, rtol=0)
    vi, vi_policy, vi_sweeps = value_iteration()
    pi, _, pi_rounds = policy_iteration()
    mpi, _, mpi_rounds = truncated_policy_iteration()
    for v in (vi, pi, mpi, evaluate(vi_policy)):
        np.testing.assert_allclose(v, [0.9, 1, 1, 0], atol=1e-12, rtol=0)
    # Independent oracle: enumerate all 2^3 deterministic nonterminal policies.
    all_values = [evaluate(np.eye(2)[list(actions) + [0]]) for actions in itertools.product(range(2), repeat=3)]
    np.testing.assert_allclose(np.max(all_values, axis=0), vi, atol=1e-12, rtol=0)
    # Positive affine change includes the absorbing state's rewards.
    scaled_value = np.linalg.solve(np.eye(4) - GAMMA * transition, 2 * reward + 0.3)
    np.testing.assert_allclose(scaled_value, 2 * exact + 0.3 / (1 - GAMMA), atol=1e-12, rtol=0)
    results = {'settings': {'gamma': GAMMA, 'states': ['A', 'B', 'C', 'T'], 'actions': ['R', 'D'], 'numpy': np.__version__, 'mc_seeds': list(range(10)), 'control_seeds': list(range(5)), 'control_episodes': 10000, 'mc_basic_rounds': 6, 'mc_basic_samples_per_pair': 300, 'horizon': HORIZON, 'initial_return_tail_bound': GAMMA ** HORIZON / (1 - GAMMA), 'first_visit_tail_bound_in_this_grid': GAMMA ** (HORIZON - 1) / (1 - GAMMA), 'sa_seeds': '1000..1199', 'sa_samples': 5000}, 'policy_evaluation': {'value': exact.tolist(), 'q': lookahead(exact).tolist(), 'bellman_residual': float(np.max(np.abs(reward + GAMMA * transition @ exact - exact)))}, 'planning': {'optimal_value': vi.tolist(), 'greedy_actions': ['R' if a == 0 else 'D' for a in vi_policy.argmax(axis=1)], 'vi_sweeps': vi_sweeps, 'pi_rounds': pi_rounds, 'mpi_rounds': mpi_rounds, 'enumerated_policies': len(all_values)}, 'mc_prediction': mc_prediction()}
    control = {}
    for mode in ('basic', 'exploring_starts', 'epsilon_greedy'):
        gaps, behavior_values, truncations, coverage = [], [], [], []
        for seed in range(5):
            if mode == 'basic':
                behavior, trunc, count = mc_basic(seed)
                target = behavior
            else:
                behavior, target, trunc, count = mc_control(seed, mode == 'exploring_starts')
            truncations.append(trunc)
            coverage.append(count)
            # Exact model is used ONLY by this reporting oracle, never by MC updates.
            gaps.append(float(np.max(vi - evaluate(target))))
            behavior_values.append(float(evaluate(behavior)[0]))
        control[mode] = {'greedy_policy_max_gaps': gaps, 'behavior_value_at_A': behavior_values, 'truncated_episodes': truncations, 'min_pair_visits': coverage}
    results['mc_control'] = control
    sa, checkpoints, curves = stochastic_approximation()
    results['stochastic_approximation'] = sa
    return results, checkpoints, curves


def plot(path, checkpoints, curves):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(8, 4.5), constrained_layout=True)
    for name, values in curves.items():
        ax.loglog(checkpoints, values, marker='o', markersize=4, label=name)
    ax.set(xlabel='Returns sampled from A (uniform policy)', ylabel='RMSE across 200 seeds', title='Step sizes: learning the same mean, with different limits')
    ax.grid(True, which='both', alpha=0.2)
    ax.legend()
    fig.savefig(path, dpi=180, facecolor='white')
    plt.close(fig)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path)
    parser.add_argument('--plot', type=Path)
    args = parser.parse_args()
    results, checkpoints, curves = run()
    output = json.dumps(results, indent=2) + '\n'
    if args.output:
        args.output.write_text(output)
    else:
        print(output, end='')
    if args.plot:
        plot(args.plot, checkpoints, curves)
