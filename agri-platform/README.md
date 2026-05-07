# 农业产业互联网平台

## 项目简介

农业产业互联网平台是一个面向农业产业链的综合服务系统，连接农业生产、加工、流通、销售等环节，实现智能化管理和协同化运营。

## 技术栈

### 后端技术
- **框架**: Spring Boot 3.2
- **数据库**: MySQL 8.0
- **缓存**: Redis 7.0
- **ORM**: MyBatis-Plus 3.5
- **文档**: Swagger/OpenAPI 2.3
- **安全**: JWT

### 前端技术
- **框架**: React 18
- **语言**: TypeScript
- **UI库**: Ant Design 5
- **构建**: Vite 5
- **状态管理**: Zustand
- **HTTP客户端**: Axios

## 项目结构

```
agri-platform/
├── backend/                    # 后端单体应用
│   ├── src/main/java/com/agri/
│   │   ├── AgriApplication.java
│   │   ├── config/           # 配置层
│   │   ├── common/           # 公共组件
│   │   ├── masterdata/       # 主数据模块
│   │   ├── iot/              # 物联网模块
│   │   ├── production/       # 生产管理模块
│   │   ├── trade/            # 交易撮合模块
│   │   ├── s2b2c/            # S2B2C模块
│   │   ├── finance/          # 供应链金融模块
│   │   ├── info/             # 信息资讯模块
│   │   ├── service/           # 综合服务模块
│   │   └── supervision/      # 政府监管模块
│   └── src/main/resources/
├── frontend/                  # 前端应用
│   └── agri-admin/           # 管理后台
├── database/                  # 数据库脚本
│   └── init/                 # 初始化脚本
└── docs/                     # 项目文档
```

## 快速开始

### 环境要求

- JDK 17+
- Maven 3.9+
- Node.js 18+
- pnpm 8+
- MySQL 8.0+
- Redis 7.0+

### 后端启动

1. 创建数据库并导入初始化脚本：

```bash
mysql -u root -p < database/init/init.sql
```

2. 修改配置文件 `backend/src/main/resources/application-dev.yml` 中的数据库连接信息

3. 启动后端服务：

```bash
cd backend
mvn spring-boot:run
```

4. 访问 API 文档：http://localhost:8080/swagger-ui.html

### 前端启动

1. 安装依赖：

```bash
cd frontend/agri-admin
pnpm install
```

2. 启动开发服务器：

```bash
pnpm dev
```

3. 访问应用：http://localhost:3000

### 默认账号

- 用户名: admin
- 密码: admin123

## 主要功能模块

1. **主数据管理** - 用户、角色、权限、组织、商品、客户、供应商
2. **物联网管理** - 设备接入、数据采集、监控预警
3. **生产管理** - 种植/养殖计划、农事记录、采收管理
4. **交易撮合** - 发布需求、智能匹配、在线议价
5. **S2B2C** - 供应商入驻、渠道管理、会员体系
6. **供应链金融** - 保理、仓单质押、信用评估
7. **信息资讯** - 行情数据、政策法规、行业动态
8. **综合服务** - 物流跟踪、质量溯源、农技服务
9. **政府监管** - 数据上报、统计分析、预警执法

## 开发规范

### 命名规范

- 后端包名: `com.agri.{模块}.{子包}`
- 数据库表名: `agri{模块}{实体}`
- 前端页面目录: kebab-case

### 代码风格

- 后端: 遵循阿里Java开发规范
- 前端: 遵循React和TypeScript最佳实践

## 许可证

本项目仅供学习交流使用。
