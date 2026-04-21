# 投票系统和报餐系统 API 文档

## 投票系统 API

### 1. 创建投票
**POST** `/api/voting/create`

**权限**: 管理员

**请求体**:
```json
{
  "title": "午餐投票",
  "description": "选择今天的午餐",
  "options": ["红烧肉", "清蒸鱼", "宫保鸡丁"],
  "deadline": "2026-03-25T12:00:00Z",
  "multipleChoice": false
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "投票创建成功",
  "data": {
    "votingId": 1,
    "title": "午餐投票",
    "options": [
      {"id": 1, "text": "红烧肉", "votes": 0},
      {"id": 2, "text": "清蒸鱼", "votes": 0},
      {"id": 3, "text": "宫保鸡丁", "votes": 0}
    ]
  }
}
```

### 2. 获取投票列表
**GET** `/api/voting/list`

**权限**: 已登录

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "title": "午餐投票",
      "description": "选择今天的午餐",
      "deadline": "2026-03-25T12:00:00Z",
      "multipleChoice": false,
      "createdAt": "2026-03-25T10:00:00Z"
    }
  ]
}
```

### 3. 获取投票详情
**GET** `/api/voting/:id`

**权限**: 已登录

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 1,
    "title": "午餐投票",
    "description": "选择今天的午餐",
    "deadline": "2026-03-25T12:00:00Z",
    "multipleChoice": false,
    "options": [
      {"id": 1, "text": "红烧肉", "votes": 5},
      {"id": 2, "text": "清蒸鱼", "votes": 3},
      {"id": 3, "text": "宫保鸡丁", "votes": 2}
    ],
    "hasVoted": false,
    "userVote": []
  }
}
```

### 4. 投票
**POST** `/api/voting/:id/vote`

**权限**: 已登录

**请求体**:
```json
{
  "optionIds": [1]  // 单选或多选
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "投票成功",
  "data": null
}
```

### 5. 获取投票结果
**GET** `/api/voting/:id/results`

**权限**: 管理员

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 1,
    "title": "午餐投票",
    "totalVotes": 10,
    "options": [
      {"id": 1, "text": "红烧肉", "votes": 5, "percentage": "50.00"},
      {"id": 2, "text": "清蒸鱼", "votes": 3, "percentage": "30.00"},
      {"id": 3, "text": "宫保鸡丁", "votes": 2, "percentage": "20.00"}
    ]
  }
}
```

---

## 报餐系统 API

### 1. 创建报餐活动
**POST** `/api/meal/create`

**权限**: 管理员

**请求体**:
```json
{
  "title": "周一午餐报餐",
  "description": "请选择您的午餐",
  "deadline": "2026-03-25T11:00:00Z",
  "menus": [
    {"name": "红烧肉", "price": 15, "description": "精选猪肉"},
    {"name": "清蒸鱼", "price": 18, "description": "新鲜海鱼"},
    {"name": "宫保鸡丁", "price": 12, "description": "辣味鸡丁"}
  ]
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "报餐活动创建成功",
  "data": {
    "activityId": 1,
    "title": "周一午餐报餐",
    "menus": [
      {"id": 1, "name": "红烧肉", "price": 15, "description": "精选猪肉"},
      {"id": 2, "name": "清蒸鱼", "price": 18, "description": "新鲜海鱼"},
      {"id": 3, "name": "宫保鸡丁", "price": 12, "description": "辣味鸡丁"}
    ]
  }
}
```

### 2. 获取报餐活动列表
**GET** `/api/meal/list`

**权限**: 已登录

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": 1,
      "title": "周一午餐报餐",
      "description": "请选择您的午餐",
      "deadline": "2026-03-25T11:00:00Z",
      "createdAt": "2026-03-25T09:00:00Z"
    }
  ]
}
```

### 3. 获取报餐活动详情
**GET** `/api/meal/:id`

**权限**: 已登录

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 1,
    "title": "周一午餐报餐",
    "description": "请选择您的午餐",
    "deadline": "2026-03-25T11:00:00Z",
    "menus": [
      {"id": 1, "name": "红烧肉", "price": 15, "description": "精选猪肉"},
      {"id": 2, "name": "清蒸鱼", "price": 18, "description": "新鲜海鱼"},
      {"id": 3, "name": "宫保鸡丁", "price": 12, "description": "辣味鸡丁"}
    ],
    "hasOrdered": false,
    "userOrder": null
  }
}
```

### 4. 报餐
**POST** `/api/meal/:id/order`

**权限**: 已登录

**请求体**:
```json
{
  "menuId": 1,
  "quantity": 2,
  "remarks": "不要辣"
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "报餐成功",
  "data": {
    "orderId": 1,
    "menuName": "红烧肉",
    "quantity": 2,
    "price": 15,
    "totalPrice": 30
  }
}
```

### 5. 获取报餐统计
**GET** `/api/meal/:id/statistics`

**权限**: 管理员

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 1,
    "title": "周一午餐报餐",
    "totalOrders": 25,
    "totalRevenue": 380,
    "menus": [
      {
        "id": 1,
        "name": "红烧肉",
        "price": 15,
        "orderCount": 10,
        "totalQuantity": 12,
        "totalPrice": 180
      },
      {
        "id": 2,
        "name": "清蒸鱼",
        "price": 18,
        "orderCount": 8,
        "totalQuantity": 9,
        "totalPrice": 162
      },
      {
        "id": 3,
        "name": "宫保鸡丁",
        "price": 12,
        "orderCount": 7,
        "totalQuantity": 8,
        "totalPrice": 96
      }
    ]
  }
}
```

---

## 错误响应

所有错误响应格式统一：

```json
{
  "code": -1,
  "msg": "错误信息",
  "data": null
}
```

常见错误码：
- `400`: 请求参数错误
- `401`: 未登录或 token 无效
- `403`: 权限不足
- `404`: 资源不存在
- `500`: 服务器错误

---

## 认证

所有需要认证的接口都需要在请求头中提供 token：

```
Authorization: Bearer <token>
```

Token 通过登录接口获取：

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"openid":"user123"}'
```
