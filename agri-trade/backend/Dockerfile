FROM openjdk:17-jdk-slim

WORKDIR /app

COPY target/agri-trade-1.0.0-SNAPSHOT.jar app.jar

EXPOSE 8084

ENTRYPOINT ["java", "-jar", "app.jar"]