# 实操案例：决策树鸢尾花分类

## 目标

使用决策树完成 Iris 分类，理解规则划分、树深度、可解释性和过拟合风险。

## 前置知识

- 监督学习和分类任务。
- 训练集与测试集。
- 过拟合与泛化能力。

## 实验步骤

1. 加载 Iris 数据集。
2. 划分训练集和测试集。
3. 训练默认决策树。
4. 限制树深度并对比结果。
5. 输出特征重要性和树规则。

## 参考代码

```python
from sklearn.datasets import load_iris
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier, export_text
from sklearn.metrics import accuracy_score

iris = load_iris()
X_train, X_test, y_train, y_test = train_test_split(
    iris.data,
    iris.target,
    test_size=0.3,
    random_state=42,
    stratify=iris.target,
)

tree = DecisionTreeClassifier(max_depth=3, random_state=42)
tree.fit(X_train, y_train)

print("train accuracy:", accuracy_score(y_train, tree.predict(X_train)))
print("test accuracy:", accuracy_score(y_test, tree.predict(X_test)))
print(export_text(tree, feature_names=list(iris.feature_names)))
```

## 思考题

- 为什么限制 `max_depth` 可能缓解过拟合？
- 决策树的可解释性体现在哪里？
- 如果训练准确率明显高于测试准确率，你会如何调整？

## 评分标准

- 完成训练和测试集准确率对比：25 分。
- 能解释至少三条树规则：25 分。
- 能说明树深度与过拟合的关系：30 分。
- 能提出一种改进策略：20 分。

## 可生成资源

系统可以把树规则转成自然语言讲义，生成过拟合诊断题，并推荐“训练集/测试集”“泛化能力”等前置知识点。
