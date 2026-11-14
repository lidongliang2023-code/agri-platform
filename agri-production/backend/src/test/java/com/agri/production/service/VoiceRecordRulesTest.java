package com.agri.production.service;

import com.agri.production.dto.VoiceRecordDraft;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.*;

class VoiceRecordRulesTest {
    private final LocalDateTime now=LocalDateTime.of(2026,11,14,14,45);
    private VoiceRecordDraft draft(String type,String area,String qty,String maximum,String evidence,Integer interval) {
        return new VoiceRecordDraft(1L,null,type,now.minusHours(1),2L,new BigDecimal(area),3L,
            qty==null?null:new BigDecimal(qty),"g",new BigDecimal("2"),"真实作业事实",evidence,maximum==null?null:new BigDecimal(maximum),interval);
    }
    @Test void emptyDraftRequiresFactsRatherThanDefaults(){var r=VoiceRecordRules.validate(new VoiceRecordDraft(null,null,null,null,null,null,null,null,null,null,null,null,null,null),BigDecimal.TEN,now);assertTrue(r.missing().size()>=6);}
    @Test void ordinaryWorkCanProceedToHumanConfirmation(){var r=VoiceRecordRules.validate(draft("ventilation","1",null,null,null,null),BigDecimal.TEN,now);assertTrue(r.missing().isEmpty());assertTrue(r.warnings().isEmpty());}
    @Test void areaOverTwentyPercentNeedsReview(){var r=VoiceRecordRules.validate(draft("irrigating","12.01",null,null,null,null),BigDecimal.TEN,now);assertTrue(r.warnings().stream().anyMatch(x->x.contains("20%")));}
    @Test void areaAbovePlotStillNeedsReviewBelowSevereThreshold(){var r=VoiceRecordRules.validate(draft("irrigating","10.1",null,null,null,null),BigDecimal.TEN,now);assertFalse(r.warnings().isEmpty());}
    @Test void unknownPlotAreaNeverSilentlyPasses(){assertFalse(VoiceRecordRules.validate(draft("irrigating","1",null,null,null,null),null,now).warnings().isEmpty());}
    @Test void overdoseAboveThreeTimesIsExplicit(){var r=VoiceRecordRules.validate(draft("pest_control","1","301","100","登记原文",7),BigDecimal.TEN,now);assertTrue(r.warnings().stream().anyMatch(x->x.contains("3倍")));}
    @Test void pesticidesAlwaysRequireTechnicalReview(){var r=VoiceRecordRules.validate(draft("pest_control","1","50","100","登记原文",7),BigDecimal.TEN,now);assertTrue(r.warnings().stream().anyMatch(x->x.contains("技术员")));}
    @Test void missingRegistrationAndIntervalRemainVisible(){var r=VoiceRecordRules.validate(draft("pest_control","1","50",null,null,null),BigDecimal.TEN,now);assertTrue(r.warnings().size()>=3);}
    @Test void harvestMustReuseExistingBatch(){var r=VoiceRecordRules.validate(draft("harvesting","1","400",null,null,null),BigDecimal.TEN,now);assertTrue(r.missing().stream().anyMatch(x->x.contains("批次")));}
    @Test void pesticideCannotBypassReviewAsFertilizer(){assertFalse(VoiceRecordRules.matchesInputType("fertilizing","PESTICIDE"));assertTrue(VoiceRecordRules.matchesInputType("pest_control","PESTICIDE"));}
    @Test void fertilizersRequireTheirOwnOperation(){assertTrue(VoiceRecordRules.matchesInputType("fertilizing","fertilizer"));assertFalse(VoiceRecordRules.matchesInputType("pest_control","FERTILIZER"));}
    @Test void unrelatedOperationCannotCarryInput(){assertFalse(VoiceRecordRules.matchesInputType("other","PESTICIDE"));}
    @Test void unsupportedAudioIsRejected(){assertThrows(IllegalArgumentException.class,()->VoiceTranscriptionService.validatedType("not an audio file".getBytes()));}
    @Test void supportedWaveMagicIsAccepted(){byte[] bytes=new byte[20];System.arraycopy("RIFF".getBytes(),0,bytes,0,4);System.arraycopy("WAVE".getBytes(),0,bytes,8,4);assertEquals("audio/wav",VoiceTranscriptionService.validatedType(bytes));}
    @Test void oversizedAudioIsRejected(){assertThrows(IllegalArgumentException.class,()->VoiceTranscriptionService.validatedType(new byte[12*1024*1024+1]));}
}
