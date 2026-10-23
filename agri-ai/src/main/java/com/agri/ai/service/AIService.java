package com.agri.ai.service;

public interface AIService {

    String chat(String prompt);

    String recommend(String context);

    String riskAnalysis(String context);

    String summarize(String text);
}