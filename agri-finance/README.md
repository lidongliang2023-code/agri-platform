# 供应链金融模块

## 数据库

默认运行环境使用 MySQL 8：

- 数据库：`agri_finance`
- 默认地址：`localhost:3306`
- 默认账号：`root`
- 默认密码：`root`

首次启动前创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS agri_finance
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

后端启动时会执行 `schema.sql` 建表，并使用 `data-mysql.sql` 写入幂等初始化数据。

可通过环境变量覆盖连接信息：

```text
MYSQL_HOST
MYSQL_PORT
MYSQL_DATABASE
MYSQL_USERNAME
MYSQL_PASSWORD
```

H2 文件数据库仅作为可选开发模式保留：

```powershell
$env:SPRING_PROFILES_ACTIVE = "h2"
java -jar target/agri-finance-1.0.0-SNAPSHOT.jar
```

## 本地启动

```powershell
mvn -s C:\Users\71502\.m2\settings.xml "-Dmaven.repo.local=C:\maven\repository" clean package -DskipTests
powershell -NoProfile -ExecutionPolicy Bypass -File ..\..\ops\local\start-production-stack.ps1
```

访问地址：

- 融资方端：`http://localhost:8081/finance/#/borrower/home`
- 资金方端：`http://localhost:8081/finance/#/fund/workbench`
- 运营风控端：`http://localhost:8081/finance/#/admin/workbench`
