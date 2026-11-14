package com.agri.production.dto;

import jakarta.validation.constraints.*;
import lombok.Data;
import java.util.List;

@Data
public class PestDiagnosisRequest {
    @NotBlank @Size(max=64) private String requestId;
    @NotBlank @Size(max=100) private String plotId;
    @NotBlank @Size(max=100) private String cropName;
    @NotBlank @Size(max=3000) private String symptoms;
    @Size(max=100) private String growthStage;
    @Size(max=1000) private String environment;
    @Size(max=1000) private String recentTreatment;
    @Size(max=3000) private String voiceTranscript;
    @Size(max=2000) private String localBulletin;
    @Size(max=200) private String bulletinSource;
    @NotNull @Size(min=1,max=3) private List<@NotBlank String> images;
}
