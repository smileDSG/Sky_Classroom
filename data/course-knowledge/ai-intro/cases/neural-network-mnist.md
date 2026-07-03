# 实操案例：简易神经网络识别 MNIST

## 目标

使用 PyTorch 搭建一个简单神经网络完成手写数字识别，理解前向传播、损失函数、反向传播和优化过程。

## 前置知识

- 神经元、激活函数和多层感知机。
- 训练集、测试集和准确率。
- 梯度下降的基本直觉。

## 实验步骤

1. 加载 MNIST 数据。
2. 定义简单 MLP 模型。
3. 设置损失函数和优化器。
4. 训练若干轮并记录损失。
5. 在测试集上计算准确率。

## 参考代码

```python
import torch
from torch import nn
from torch.utils.data import DataLoader
from torchvision import datasets, transforms

transform = transforms.Compose([transforms.ToTensor()])

train_data = datasets.MNIST(root="./data", train=True, download=True, transform=transform)
test_data = datasets.MNIST(root="./data", train=False, download=True, transform=transform)

train_loader = DataLoader(train_data, batch_size=64, shuffle=True)
test_loader = DataLoader(test_data, batch_size=256)

model = nn.Sequential(
    nn.Flatten(),
    nn.Linear(28 * 28, 128),
    nn.ReLU(),
    nn.Linear(128, 10),
)

loss_fn = nn.CrossEntropyLoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

for epoch in range(3):
    model.train()
    total_loss = 0.0
    for X, y in train_loader:
        pred = model(X)
        loss = loss_fn(pred, y)
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total_loss += loss.item()
    print(f"epoch={epoch + 1}, loss={total_loss / len(train_loader):.4f}")

model.eval()
correct = 0
total = 0
with torch.no_grad():
    for X, y in test_loader:
        pred = model(X).argmax(dim=1)
        correct += (pred == y).sum().item()
        total += y.numel()

print("test accuracy:", correct / total)
```

## 思考题

- `optimizer.zero_grad()` 为什么必须执行？
- 如果训练损失下降但测试准确率不提升，可能是什么原因？
- MLP 和 CNN 处理图像的差异是什么？

## 评分标准

- 能正确运行训练流程：30 分。
- 能解释损失函数和优化器作用：25 分。
- 能说明 `backward()` 的直觉含义：25 分。
- 能完成一次模型改进尝试：20 分。

## 可生成资源

系统可以生成逐行代码讲解、训练流程动画、错误样本分析表和 CNN 拓展任务。
