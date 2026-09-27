"""Reproducible RL notes 7-10. Python 3.10+, NumPy; optional Matplotlib.
Run: python ch7-10.py --output results-7-10.json --plot learning-7-10.png
All grid episodes start at A; T is terminal, not a time-limit truncation.
"""
import argparse
import json
from pathlib import Path
import numpy as np

GAMMA = .9
NEXT = np.array([[1, 2], [1, 3], [3, 2], [3, 3]])
REWARD = ((NEXT == 3) & (np.arange(4)[:, None] != 3)).astype(float)
UNIFORM = np.full((4, 2), .5)
V_STAR = np.array([.9, 1., 1., 0.])
Q_STAR = REWARD + GAMMA * V_STAR[NEXT]
CHECKPOINTS = (100, 1000, 5000)


def exact(policy, initial=None):
    p = np.zeros((4, 4))
    for s in range(4):
        for a in range(2):
            p[s, NEXT[s, a]] += policy[s, a]
    v = np.linalg.solve(np.eye(4) - GAMMA*p, (policy*REWARD).sum(1))
    q = REWARD + GAMMA*v[NEXT]
    rho = np.array([1., 0, 0, 0]) if initial is None else initial
    occupancy = np.linalg.solve((np.eye(4)-GAMMA*p).T, rho)
    return v, q, occupancy


def softmax_policy(theta):
    prob = 1/(1+np.exp(-theta))
    return np.vstack([np.column_stack([prob, 1-prob]), [.5, .5]])


def score(policy, s, a):
    g = np.zeros(3)
    if s != 3:
        g[s] = (a == 0) - policy[s, 0]
    return g


def gradient(theta):
    pi = softmax_policy(theta)
    v, q, occupancy = exact(pi)
    g = sum(occupancy[s]*pi[s,a]*q[s,a]*score(pi,s,a)
            for s in range(3) for a in range(2))
    return v[0], g


def epsilon_policy(q, epsilon=.2):
    # R wins exact ties, matching Chapters 1-6.
    p = np.full(2, epsilon/2)
    p[np.argmax(q)] += 1-epsilon
    return p


def episode(rng, policy):
    trajectory = []
    s = 0
    for _ in range(10000):
        a = int(rng.choice(2, p=policy[s]))
        sp, r = int(NEXT[s,a]), REWARD[s,a]
        trajectory.append((s,a,r,sp))
        if sp == 3:
            return trajectory
        s = sp
    raise RuntimeError('Nonterminating run: abort; do not label a time limit terminal')


def returns(trajectory):
    result = np.empty(len(trajectory))
    g = 0.
    for t in reversed(range(len(trajectory))):
        g = trajectory[t][2] + GAMMA*g
        result[t] = g
    return result


def summarize(values):
    x = np.asarray(values)
    return {'mean': float(x.mean()), 'std': float(x.std(ddof=1))}


def prediction():
    truth = exact(UNIFORM)[0]
    results = {str(n): {'mc': [], 'td': []} for n in CHECKPOINTS}
    for seed in range(10):
        rng = np.random.default_rng(seed)
        mc, td, nc, nt = np.zeros((4,4))
        for ep in range(1, CHECKPOINTS[-1]+1):
            trajectory = episode(rng, UNIFORM)
            seen = set()
            for (s, a, r, sp), g in zip(trajectory, returns(trajectory)):
                nt[s] += 1
                td[s] += nt[s]**(-.6)*(r+GAMMA*td[sp]-td[s])
                if s not in seen:
                    nc[s] += 1
                    mc[s] += (g-mc[s])/nc[s]
                    seen.add(s)
            if ep in CHECKPOINTS:
                for name, v in [('mc',mc),('td',td)]:
                    results[str(ep)][name].append(float(np.sqrt(np.mean((v[:3]-truth[:3])**2))))
    return {n: {k:summarize(v) for k,v in row.items()} for n,row in results.items()}


def n_step_target(rewards, tau, n, terminal_time, bootstrap):
    end = min(tau+n, int(terminal_time) if np.isfinite(terminal_time) else tau+n)
    value = sum(GAMMA**(i-tau-1)*rewards[i] for i in range(tau+1,end+1))
    if tau+n < terminal_time:
        value += GAMMA**n*bootstrap
    return value


def control(kind, seed, episodes=5000):
    rng = np.random.default_rng(seed)
    q, counts = np.zeros((4,2)), np.zeros((4,2))
    for _ in range(episodes):
        s = 0
        a = int(rng.choice(2, p=epsilon_policy(q[s])))
        states, actions, rewards = [s], [a], [0.]
        T = float('inf')
        n = 3 if kind == 'n_step_sarsa' else 1
        for t in range(10000+n):
            if t < T:
                s, a = states[t], actions[t]
                sp, r = int(NEXT[s,a]), REWARD[s,a]
                states.append(sp)
                rewards.append(r)
                if sp == 3:
                    T = t+1
                else:
                    actions.append(int(rng.choice(2,p=epsilon_policy(q[sp]))))
            tau = t-n+1
            if tau >= 0:
                boot = 0.
                if tau+n < T:
                    sp = states[tau+n]
                    if kind == 'q_learning':
                        boot = q[sp].max()
                    elif kind == 'expected_sarsa':
                        boot = epsilon_policy(q[sp]) @ q[sp]
                    else:
                        boot = q[sp,actions[tau+n]]
                target = n_step_target(rewards,tau,n,T,boot)
                st, at = states[tau], actions[tau]
                counts[st,at] += 1
                q[st,at] += counts[st,at]**(-.6)*(target-q[st,at])
            if tau == T-1:
                break
        else:
            raise RuntimeError('Control failed to terminate')
    behavior = np.array([epsilon_policy(row) for row in q])
    greedy = np.eye(2)[q.argmax(1)]
    target_q = Q_STAR if kind == 'q_learning' else exact(behavior)[1]
    return {'q_rmse': float(np.sqrt(np.mean((q[:3]-target_q[:3])**2))),
            'greedy_value': float(exact(greedy)[0][0]),
            'behavior_value': float(exact(behavior)[0][0]),
            'minimum_pair_visits': int(counts[:3].min())}


def approximation():
    p = np.array([[0,.5,.5],[0,.5,0],[0,0,.5]])
    r = np.array([0,.5,.5])
    truth = exact(UNIFORM)[0][:3]
    d = np.eye(3)/3
    results = {}
    for name, features in [('constant',np.ones((3,1))),
                           ('two_features',np.array([[1.,0],[1,1],[1,1]]))]:
        a = features.T @ d @ (np.eye(3)-GAMMA*p) @ features
        b = features.T @ d @ r
        td = np.linalg.solve(a,b)
        mc = np.linalg.solve(features.T@d@features, features.T@d@truth)
        assert np.max(np.abs(features.T@d@(r+GAMMA*p@features@td-features@td))) < 1e-12
        # Independent state samples; do not claim this D is a stationary distribution.
        errors = []
        for seed in range(10):
            rng = np.random.default_rng(100+seed)
            w = np.zeros(features.shape[1])
            for k in range(1,30001):
                s, action = int(rng.integers(3)), int(rng.integers(2))
                sp = NEXT[s,action]
                future = 0. if sp == 3 else features[sp]@w
                delta = REWARD[s,action]+GAMMA*future-features[s]@w
                w += .2*k**(-.6)*delta*features[s]
            errors.append(np.sqrt(np.mean((features@w-features@td)**2)))
        results[name] = {'td_weights':td.tolist(),'least_squares_weights':mc.tolist(),
                         'td_values':(features@td).tolist(),'least_squares_values':(features@mc).tolist(),
                         'sampled_td_error_to_fixed_point':summarize(errors)}
    # A fully specified off-distribution linear TD instability, with zero rewards.
    phi = np.array([1.,2.]); sampling = np.array([.99,.01])
    drift = float(np.sum(sampling*phi*(phi-GAMMA*2)))
    results['unstable_example'] = {'A':drift, 'initial_weight':1., 'step_size':.1,
                                  'weight_after_100_mean_updates':float((1-.1*drift)**100)}
    return results


class Network:
    def __init__(self, rng):
        self.w1 = rng.normal(0,.3,(4,16)); self.b1 = np.zeros(16)
        self.w2 = rng.normal(0,.3,(16,2)); self.b2 = np.zeros(2)

    def __call__(self, states):
        h = np.tanh(self.w1[states]+self.b1)
        return h@self.w2+self.b2

    def copy_from(self, other):
        for name in ('w1','b1','w2','b2'):
            setattr(self,name,getattr(other,name).copy())

    def gradients(self, states, actions, targets):
        h = np.tanh(self.w1[states]+self.b1)
        out = h@self.w2+self.b2
        residual = out[np.arange(len(states)),actions]-targets
        dq = np.zeros_like(out)
        dq[np.arange(len(states)),actions] = residual/len(states)
        dh = (dq@self.w2.T)*(1-h*h)
        dw1 = np.zeros_like(self.w1)
        np.add.at(dw1,states,dh)
        return .5*np.mean(residual**2), (dw1, dh.sum(0), h.T@dq, dq.sum(0))

    def update(self, states, actions, targets):
        loss, grads = self.gradients(states,actions,targets)
        for name, grad in zip(('w1','b1','w2','b2'),grads):
            setattr(self,name,getattr(self,name)-.03*grad)
        return float(loss)


def dqn():
    rows = []
    for seed in range(5):
        rng = np.random.default_rng(200+seed)
        # Offline replay collected by a uniform behavior; all six nonterminal pairs covered.
        replay = np.array([step for _ in range(1000) for step in episode(rng,UNIFORM)])
        s,a,r,sp = replay.T
        s,a,sp = s.astype(int),a.astype(int),sp.astype(int)
        assert len(set(zip(s,a))) == 6
        net, target = Network(rng), Network(rng)
        target.copy_from(net)
        for k in range(1,3001):
            ix = rng.integers(len(replay),size=32)
            y = r[ix]+GAMMA*(sp[ix]!=3)*target(sp[ix]).max(1)
            net.update(s[ix],a[ix],y)
            if k % 100 == 0:
                target.copy_from(net)
        q = net(np.arange(4)); q[3] = 0.
        v = exact(np.eye(2)[q.argmax(1)])[0][0]
        rows.append({'seed':200+seed,'replay_size':len(replay),
                     'q_rmse':float(np.sqrt(np.mean((q[:3]-Q_STAR[:3])**2))),
                     'greedy_value':float(v)})
    return rows


def pg_variance():
    theta = np.array([-.4,.7,-.9])
    policy = softmax_policy(theta)
    truth, gtrue = gradient(theta)
    v = exact(policy)[0]
    estimates = {'no_baseline':[], 'exact_value_baseline':[]}
    for seed in range(100):
        rng = np.random.default_rng(300+seed)
        batch = {key:np.zeros(3) for key in estimates}
        for _ in range(100):
            trajectory = episode(rng,policy)
            gs = returns(trajectory)
            for t, ((s,a,r,sp),g) in enumerate(zip(trajectory,gs)):
                z = GAMMA**t*score(policy,s,a)
                batch['no_baseline'] += z*g
                batch['exact_value_baseline'] += z*(g-v[s])
        for key in estimates:
            estimates[key].append(batch[key]/100)
    return {'theta':theta.tolist(),'exact_value':truth,'exact_gradient':gtrue.tolist(),
            **{key:{'mean_gradient':np.mean(vs,axis=0).tolist(),
                    'trace_covariance':float(np.trace(np.cov(np.array(vs).T))),
                    'rmse_to_exact':float(np.sqrt(np.mean((np.array(vs)-gtrue)**2)))}
               for key,vs in estimates.items()}}


def actor_training(kind, seed):
    rng = np.random.default_rng(500+seed)
    theta, v, q = np.zeros(3), np.zeros(4), np.zeros((4,2))
    trace = []
    for ep in range(1,3001):
        pi = softmax_policy(theta)  # Freeze actor for the complete episode.
        trajectory = episode(rng,pi)
        gs = returns(trajectory)
        gtheta = np.zeros(3)
        old_v = v.copy()
        for t,(s,a,r,sp) in enumerate(trajectory):
            if kind == 'reinforce':
                advantage = gs[t]-old_v[s] # Baseline fitted only on preceding episodes.
            elif kind == 'qac':
                advantage = q[s,a]
            else:
                advantage = r+GAMMA*v[sp]-v[s]
            gtheta += GAMMA**t*score(pi,s,a)*advantage
            if kind == 'reinforce':
                v[s] += .1*(gs[t]-v[s])
            elif kind == 'qac':
                boot = 0. if sp == 3 else q[sp,trajectory[t+1][1]]
                q[s,a] += .1*(r+GAMMA*boot-q[s,a])
            else:
                v[s] += .1*(r+GAMMA*v[sp]-v[s])
        theta += .1*gtheta
        if ep in (1,100,500,1000,3000):
            trace.append(float(exact(softmax_policy(theta))[0][0]))
    return trace


def off_policy_check():
    theta = np.array([-.4,.7,-.9]); pi = softmax_policy(theta)
    v,q,m = exact(pi); vb,qb,mb = exact(UNIFORM)
    _, truth = gradient(theta)
    corrected, action_only = np.zeros(3), np.zeros(3)
    for s in range(3):
        for a in range(2):
            term = mb[s]*UNIFORM[s,a]*(pi[s,a]/UNIFORM[s,a])*score(pi,s,a)*(q[s,a]-v[s])
            action_only += term
            corrected += m[s]/mb[s]*term
    np.testing.assert_allclose(corrected,truth,atol=1e-12,rtol=0)
    assert np.linalg.norm(action_only-truth)>1e-3
    return {'exact_gradient':truth.tolist(),'state_and_action_corrected':corrected.tolist(),
            'action_only':action_only.tolist()}


def deterministic_ac():
    rows=[]
    for seed in range(20):
        rng=np.random.default_rng(800+seed)
        w=np.zeros(3); theta=0.
        for k in range(1,5001):
            a=rng.uniform(-1,1)
            reward=-(a-.7)**2+rng.normal(0,.01)
            phi=np.array([1,a,a*a])
            w += .05*(reward-phi@w)*phi
            if k>200:
                theta = np.clip(theta+.01*(w[1]+2*w[2]*theta),-1,1)
        rows.append({'theta':float(theta),'objective':float(-(theta-.7)**2),
                     'critic_coefficient_error':float(np.linalg.norm(w-np.array([-.49,1.4,-1])))})
    return {key:summarize([row[key] for row in rows]) for key in rows[0]}


def checks():
    np.testing.assert_allclose(exact(UNIFORM)[0],[9/11,10/11,10/11,0],atol=1e-12,rtol=0)
    # Analytic policy gradient vs central differences of the solved return.
    errors=[]
    for theta in (np.zeros(3),np.array([-.4,.7,-.9]),np.array([1.,-2.,.3])):
        _,g=gradient(theta); h=1e-5
        fd=np.array([(gradient(theta+np.eye(3)[i]*h)[0]-gradient(theta-np.eye(3)[i]*h)[0])/(2*h) for i in range(3)])
        errors.append(float(np.max(np.abs(fd-g))))
        np.testing.assert_allclose(fd,g,atol=1e-9,rtol=0)
    # Known two-step trajectory A->B->T: n-step return and terminal masking.
    np.testing.assert_allclose(returns([(0,0,0.,1),(1,1,1.,3)]),[.9,1.],atol=1e-12,rtol=0)
    # Check bootstrap exponents and all pending terminal suffixes independently.
    rr = [0., .2, .3, 1.]
    np.testing.assert_allclose(n_step_target(rr,0,2,3,.8),1.118,atol=1e-12,rtol=0)
    np.testing.assert_allclose([n_step_target(rr,t,3,3,999.) for t in range(3)],
                               [1.28,1.2,1.],atol=1e-12,rtol=0)
    # A one-hot linear action-value update is exactly a tabular update.
    features=np.eye(6); weights=np.arange(6,dtype=float)/10
    before=weights.reshape(3,2).copy(); delta=.37; alpha=.2
    weights += alpha*delta*features[3]; before[1,1] += alpha*delta
    np.testing.assert_allclose(weights.reshape(3,2),before,atol=1e-12,rtol=0)
    # Check all neural-network parameters with frozen targets, including duplicate states.
    rng=np.random.default_rng(42); net=Network(rng)
    ss=np.array([0,1,1,2]); aa=np.array([0,0,1,1]); yy=np.array([.2,.3,1.,1.])
    _,grads=net.gradients(ss,aa,yy); max_error=0.
    for name,grad in zip(('w1','b1','w2','b2'),grads):
        param=getattr(net,name)
        for idx in np.ndindex(param.shape):
            old=param[idx]; h=1e-5
            param[idx]=old+h; plus=net.gradients(ss,aa,yy)[0]
            param[idx]=old-h; minus=net.gradients(ss,aa,yy)[0]
            param[idx]=old
            max_error=max(max_error,abs((plus-minus)/(2*h)-grad[idx]))
    assert max_error<1e-9
    # Continuous one-step task: d[-(theta-.7)^2]/dtheta=2(.7-theta).
    theta=.2; h=1e-5
    fd=(-((theta+h)-.7)**2+((theta-h)-.7)**2)/(2*h)
    np.testing.assert_allclose(fd,2*(.7-theta),atol=1e-9,rtol=0)
    return {'policy_gradient_max_errors':errors,'network_gradient_max_error':max_error,
            'terminal_return_and_one_hot_checks':'passed','n_step_bootstrap_and_terminal_suffixes':'passed',
            'deterministic_gradient_check':'passed'}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default='results-7-10.json')
    parser.add_argument('--plot')
    args=parser.parse_args()
    report={'settings':{'gamma':GAMMA,'numpy':np.__version__,
        'prediction_seeds':list(range(10)),'prediction_episodes':5000,'td_steps':'N(s)^(-0.6)',
        'control_seeds':list(range(10)),'control_episodes':5000,'epsilon':.2,'control_steps':'N(s,a)^(-0.6)',
        'linear_td_seeds':list(range(100,110)),'linear_td_samples':30000,'linear_td_steps':'0.2*k^(-0.6)',
        'dqn_seeds':list(range(200,205)),'replay_episodes':1000,'dqn_updates':3000,
        'dqn_batch_size':32,'dqn_learning_rate':.03,'target_sync_steps':100,'network':'4-16(tanh)-2',
        'gradient_seeds':list(range(300,400)),'gradient_batch_episodes':100,
        'actor_seeds':list(range(500,520)),'actor_episodes':3000,'actor_step':.1,'critic_step':.1,
        'deterministic_seeds':list(range(800,820)),'deterministic_samples':5000,
        'deterministic_critic_step':.05,'deterministic_actor_step':.01,'deterministic_warmup':200,
        'termination':'T; guard raises after 10000 steps, never substitutes terminal reward',
        'error_metric':'prediction RMSE across three nonterminal states; q RMSE across six pairs; std ddof=1'},
        'checks':checks()}
    print('Analytic checks passed',flush=True)
    report['prediction']=prediction()
    print('Prediction complete',flush=True)
    report['control']={kind:[control(kind,seed) for seed in range(10)]
                       for kind in ('sarsa','expected_sarsa','n_step_sarsa','q_learning')}
    print('Control complete',flush=True)
    report['approximation']=approximation(); report['dqn']=dqn()
    print('Approximation and DQN complete',flush=True)
    report['policy_gradient']=pg_variance(); report['off_policy']=off_policy_check()
    report['actor_learning']={kind:np.array([actor_training(kind,seed) for seed in range(20)]).tolist()
                              for kind in ('reinforce','qac','a2c')}
    report['actor_checkpoints']=[1,100,500,1000,3000]
    report['deterministic_ac']=deterministic_ac()
    Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
    if args.plot:
        import matplotlib.pyplot as plt
        fig,axes=plt.subplots(2,1,figsize=(6.6,8.4),layout='constrained')
        for kind in ('mc','td'):
            axes[0].plot(CHECKPOINTS,[report['prediction'][str(n)][kind]['mean'] for n in CHECKPOINTS],marker='o',label=kind.upper())
        axes[0].set(xscale='log',yscale='log',xlabel='Episodes',ylabel='Mean state RMSE (10 seeds)',title='Fixed uniform policy: prediction')
        for kind,rows in report['actor_learning'].items():
            arr=np.array(rows); xs=report['actor_checkpoints']; mean=arr.mean(0); std=arr.std(0,ddof=1)
            axes[1].plot(xs,mean,marker='o',label=kind.upper())
            axes[1].fill_between(xs,mean-std,mean+std,alpha=.15)
        axes[1].axhline(.9,color='black',ls='--',label='Optimal value')
        axes[1].set(xscale='log',xlabel='Episodes',ylabel='Exact value from A',title='Policy learning: mean +/- 1 SD (20 seeds)')
        for ax in axes:
            ax.legend(); ax.grid(alpha=.25)
        fig.savefig(args.plot,dpi=160)
    print('Saved',args.output,flush=True)


if __name__=='__main__':
    main()
