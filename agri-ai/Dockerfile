FROM openjdk:17-jdk-slim

WORKDIR /app

COPY target/agri-ai-1.0.0.jar app.jar

EXPOSE 8085

ENTRYPOINT ["java", "-jar", "app.jar"]