# 农业产业互联网平台

## 项目概述

农业产业互联网平台是一个面向农业产业链的综合服务系统，连接农业生产、加工、流通、销售等环节，实现智能化管理和协同化运营。

## 技术栈

### 第一阶段：单体架构

- **后端**: Spring Boot 3.2 + MySQL 8.0 + Redis 7.0
- **前端**: React 18 + TypeScript + Ant Design Pro + Vite
- **构建**: Maven 3.9 + Node.js 18 + pnpm 8

### 后续升级路径（第二阶段）

- Spring Cloud 2023 微服务
- Nacos 注册中心 + 配置中心
- Spring Cloud Gateway API 网关
- Kafka 消息队列
- Elasticsearch 搜索引擎
- Docker 容器化部署

## 业务模块

| 模块编号 | 模块名称 | 英文标识 | 核心功能 |
| :--- | :--- | :--- | :--- |
| 1 | 主数据管理 | master-data | 用户、角色、权限、组织、商品、客户、供应商 |
| 2 | 物联网管理 | iot | 设备接入、数据采集、监控预警 |
| 3 | 生产管理 | production | 种植/养殖计划、农事记录、采收管理 |
| 4 | 交易撮合 | trade | 发布需求、智能匹配、在线议价 |
| 5 | S2B2C | s2b2c | 供应商入驻、渠道管理、会员体系 |
| 6 | 供应链金融 | finance | 保理、仓单质押、信用评估 |
| 7 | 信息资讯 | info | 行情数据、政策法规、行业动态 |
| 8 | 综合服务 | service | 物流跟踪、质量溯源、农技服务 |
| 9 | 政府监管 | supervision | 数据上报、统计分析、预警执法 |

## 快速开始

### 环境要求

- JDK 17 LTS
- Maven 3.9.x
- Node.js 18 LTS
- pnpm 8.x
- MySQL 8.0.x
- Redis 7.0.x

### 运行项目

#### 后端

```bash
cd backend
mvn spring-boot:run
```

#### 前端

```bash
cd frontend
pnpm install
pnpm dev
```

## 目录结构

```
agri-platform/
├── backend/              # 后端 Spring Boot 应用
│   ├── src/
│   │   └── main/
│   │       ├── java/     # Java 源代码
│   │       └── resources/ # 配置文件
│   └── pom.xml           # Maven 配置
├── frontend/             # 前端 React 应用
│   ├── src/              # 前端源代码
│   ├── public/           # 静态资源
│   └── package.json      # npm 配置
└── README.md             # 项目说明
```

## License

MIT
