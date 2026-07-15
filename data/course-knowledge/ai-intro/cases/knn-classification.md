# 实操案例：KNN 鸢尾花分类

## 目标

使用 KNN 完成 Iris 鸢尾花分类，理解“相似样本投票”的基本思想，并观察 K 值和特征缩放对结果的影响。

## 前置知识

- 分类任务与标签。
- 训练集、测试集和准确率。
- 欧氏距离和特征缩放。

## 实验步骤

1. 加载 Iris 数据集。
2. 划分训练集和测试集。
3. 使用标准化处理特征。
4. 训练 KNN 分类器。
5. 调整 K 值并比较准确率。

## 参考代码

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neighbors import KNeighborsClassifier
from sklearn.metrics import accuracy_score, classification_report

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data,
    iris.target,
    test_size=0.3,
    random_state=42,
    stratify=iris.target,
)

model = Pipeline(
    [
        ("scaler", StandardScaler()),
        ("knn", KNeighborsClassifier(n_neighbors=5)),
    ]
)

model.fit(X_train, y_train)
y_pred = model.predict(X_test)

print("accuracy:", accuracy_score(y_test, y_pred))
print(classification_report(y_test, y_pred, target_names=iris.target_names))
```

## 思考题

- 如果去掉 `StandardScaler`，结果可能发生什么变化？
- K 值过小和过大分别可能带来什么问题？
- KNN 的训练过程为什么很快，而预测过程可能较慢？

## 评分标准

- 能正确运行代码并解释输出：30 分。
- 能说明 K 值对模型的影响：25 分。
- 能说明特征缩放的意义：25 分。
- 能完成一次错误样本分析：20 分。

## 可生成资源

个性化系统可以基于本案例生成图解讲义、分步代码解释、K 值对比实验表和诊断练习题。
