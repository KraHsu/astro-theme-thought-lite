---
title: Windows下安装IsaacSim/IsaacLab解决"缺少hdf5.dll"的问题
timestamp: 2026-03-14 01:43:43+08:00
tags: [IsaacSim,IsaacLab,疑难杂症]
description: 在Windows下安装IsaacSim和IsaacLab时遇到了“缺少hdf5.dll”的报错，记录问题解决方案。
---

## Windows下安装IsaacSim/IsaacLab解决"缺少hdf5.dll"的问题

核心报错信息：

```bash
"<path_to_py>/hdf5_dataset_file_handler.py", line 15, in <module> import h5py File "<site-packages>\h5py\__init__.py", line 25, in <module> from . import _errors ImportError: DLL load failed while importing _errors: 找不到指定的程序。
```

## 原因分析

首先这个问题其实跟 `IsaacSim` `IsaacLab` 本身的关系不大，从报错信息中很容易看出，只是因为作者在使用其进行开发的时候遇到了这个问题，才如此记录。

其根本原因是 `h5py` 并不是*纯 Python 包*，而是 `HDF5` 的*Python 封装*，因此，若环境中的 `h5py` 绑定了**不兼容**的 HDF5 或相关 DLL，就会出现 `_errors ImportError`。

而`h5py`官方文档也明确建议优先使用预编译版本（`pre-built version`），包括 Python 发行版、系统包管理器或 PyPI wheel。

但是实际测试，在我的环境下（`Win11 + conda + cp11`），无论是直接使用`pip`安装还是`conda`，都会出现这个错误。

## 解决方案

直接从`pypi`下载对应三元组的`.whl`（在作者的环境下就是`h5py-3.16.0-cp311-cp311-win_amd64.whl`），放到对应环境的`site-package`目录下即可。

注意这里要卸载掉原来安装过的`h5py`。