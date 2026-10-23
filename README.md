# 农业产业互联网平台

## 项目概述

农业产业互联网平台是一个面向农业产业链的综合服务系统，连接农业生产、加工、流通、销售等环节，实现智能化管理和协同化运营。平台采用微服务架构，支持多租户模式，集成AI能力和物联网技术。

## 技术栈

### 后端技术栈

- **框架**: Spring Boot 3.2 + Spring Cloud 2023
- **数据库**: MySQL 8.0 + Redis 7.0 + SQLite（开发环境）
- **消息队列**: RabbitMQ
- **搜索引擎**: Elasticsearch
- **定时任务**: XXL-Job
- **缓存**: Redis
- **构建**: Maven 3.9

### 前端技术栈

- **PC端**: Vue 3 + TypeScript + Element Plus + Vite
- **移动端**: uni-app + Vue 3 + TypeScript
- **小程序**: 微信小程序 / uni-app

### AI技术栈

- **模型网关**: AI API Gateway
- **Agent框架**: 自定义Agent Core
- **推荐引擎**: 智能推荐算法

## 模块架构

### 基础支撑层

| 模块 | 说明 | 状态 |
|------|------|------|
| agri-common | 公共基础模块（常量、枚举、异常、工具类、配置） | 已实现 |
| agri-auth | 认证授权模块（登录、注册、Token管理、Sa-Token配置） | 已实现 |

### 主数据层

| 模块 | 说明 | 状态 |
|------|------|------|
| agri-master-data | 主数据管理（用户、权限、商品、供应商、数据治理） | 已实现 |

### 核心业务层

| 模块 | 说明 | 状态 |
|------|------|------|
| agri-trade | 交易引擎（交易撮合、S2B2C、供应链金融） | 部分实现 |
| agri-production | 生产引擎（生产管理、AI质检、预测优化、食品安全追溯） | 已实现 |
| agri-service | 服务引擎（信息资讯、综合服务、政府监管） | 基础框架 |

### 技术支撑层

| 模块 | 说明 | 状态 |
|------|------|------|
| agri-ai | AI能力中台（Agent、推荐、风控、调度、溯源、客服、预测、智能合约、BI） | 基础框架 |
| agri-data-platform | 数据中台（ETL、数据仓库、指标管理、数据导出） | 基础框架 |
| agri-iot-platform | 物联网平台（协议适配、规则引擎、数字孪生、数据桥接） | 已实现 |
| agri-operation | 运营平台（营销工具、消息推送、工单客服、运营数据分析） | 基础框架 |
| agri-tech-platform | 技术平台（文件服务、消息队列、缓存服务、定时任务、区块链） | 基础框架 |

### 前端入口层

| 模块 | 说明 | 状态 |
|------|------|------|
| agri-production/frontend | 生产管理PC端 | 已实现 |
| agri-iot-platform/admin | IoT管理后台 | 已实现 |
| agri-iot-platform/web | IoT用户端 | 已实现 |
| agri-iot-platform/miniprogram | IoT小程序 | 已实现 |
| agri-master-data/web | 主数据管理前端 | 已实现 |

### 部署配置

| 模块 | 说明 | 状态 |
|------|------|------|
| agri-deploy | 部署配置（Docker、Nginx、脚本） | 已实现 |

## 目录结构

```
agri-platform/
├── agri-common/                    # 公共基础模块
│   ├── src/main/java/com/agri/common/
│   │   ├── constant/               # 全局常量（ErrorCode枚举）
│   │   ├── enums/                  # 业务枚举（AuditStatusEnum、StatusEnum）
│   │   ├── entity/                 # 基础实体（BaseEntity）
│   │   ├── exception/              # 统一异常体系（GlobalExceptionHandler、BusinessException）
│   │   ├── result/                 # 统一响应封装（ApiResponse、PageResult）
│   │   └── utils/                  # 工具类（EncryptUtils、DateUtils、BeanCopyUtils、StringUtils）
│   └── pom.xml

├── agri-auth/                      # 认证授权模块
│   ├── src/main/java/com/agri/auth/
│   │   ├── controller/             # 登录、注册、验证码接口（AuthController）
│   │   ├── service/                # 认证服务、Token管理（IAuthService、AuthServiceImpl）
│   │   ├── mapper/                 # 用户Mapper（UserMapper）
│   │   └── entity/                 # 用户、角色、权限实体（User、Role、Permission）
│   └── pom.xml

├── agri-master-data/               # 主数据管理模块
│   ├── backend/
│   │   ├── src/main/java/com/agri/
│   │   │   ├── masterdata/         # 主数据核心（User、Role、Menu、Dict）
│   │   │   ├── admin/              # 管理端（DashboardVO、UserAuditVO）
│   │   │   └── common/             # 公共层（安全、配置、工具）
│   │   ├── src/main/resources/     # 配置文件、SQL脚本、Mapper XML
│   │   └── pom.xml
│   └── web/                        # 前端（Vue 3 + Element Plus）

├── agri-trade/                     # 交易引擎
│   ├── backend/
│   │   ├── src/main/java/com/agri/trade/
│   │   │   ├── config/             # 配置类（CorsConfig、SwaggerConfig）
│   │   │   ├── entity/             # 交易实体（TradeOrder、Quote、Demand等）
│   │   │   ├── mapper/             # Mapper层
│   │   │   └── vo/                 # 视图对象（MatchResultVO）
│   │   ├── src/main/resources/     # 配置文件、SQL脚本
│   │   └── pom.xml
│   └── frontend/                   # 前端

├── agri-production/                # 生产引擎
│   ├── backend/
│   │   ├── src/main/java/com/agri/production/
│   │   │   ├── entity/             # 生产实体（Farm、Plot、Task等）
│   │   │   ├── vo/                 # 视图对象（FarmVO、PlotVO、TaskVO）
│   │   ├── src/main/resources/     # 配置文件、Mapper XML、SQL脚本
│   │   └── pom.xml
│   └── frontend/                   # 前端（Vue 3 + Element Plus）

├── agri-iot-platform/              # 物联网平台
│   ├── backend/
│   │   ├── src/main/java/com/agri/iot/
│   │   │   ├── config/             # 配置类（SecurityConfig、WebConfig等）
│   │   │   ├── dto/                # 数据传输对象
│   │   │   ├── entity/             # IoT实体（Device、Gateway、Alert等）
│   │   │   ├── mapper/             # Mapper层
│   │   │   ├── service/            # 服务层
│   │   │   └── vo/                 # 视图对象
│   │   ├── src/main/resources/     # 配置文件、SQL脚本
│   │   └── pom.xml
│   ├── admin/                      # 管理后台（Vue 3 + Element Plus）
│   ├── web/                        # 用户端（Vue 3 + Element Plus）
│   └── miniprogram/                # 小程序（uni-app）

├── agri-service/                   # 服务引擎
│   └── pom.xml

├── agri-admin/                     # 运营后台
│   └── pom.xml

├── agri-ai/                        # AI能力中台
│   └── pom.xml

├── agri-data-platform/             # 数据中台
│   └── pom.xml

├── agri-operation/                 # 运营平台
│   └── pom.xml

├── agri-tech-platform/             # 技术平台
│   └── pom.xml

├── agri-deploy/                    # 部署配置
│   ├── docker-compose.yml          # 一键启动全部服务
│   └── nginx.conf                  # Nginx配置（待创建）

└── pom.xml                         # 父POM
```

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
cd agri-platform
mvn clean install -DskipTests
cd agri-production/backend
mvn spring-boot:run
```

#### 前端

```bash
cd agri-production/frontend
pnpm install
pnpm dev
```

#### Docker部署

```bash
cd agri-deploy
docker-compose up -d
```

## License

MIT
