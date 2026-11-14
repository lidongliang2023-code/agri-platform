package com.agri.production.service;

import com.agri.production.dto.VoiceRecordDraft;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;

/** 缺失阻断、异常复核分开，阈值只用于事实记录复核，不是处方。 */
public final class VoiceRecordRules {
    private VoiceRecordRules(){}
    public static final Set<String> TYPES=Set.of("pest_control","fertilizing","irrigating","ventilation","pruning","harvesting","other");
    public record Result(List<String> missing,List<String> warnings) {}
    public static boolean matchesInputType(String operation,String inputType) {
        if("pest_control".equals(operation))return "PESTICIDE".equalsIgnoreCase(inputType);
        if("fertilizing".equals(operation))return "FERTILIZER".equalsIgnoreCase(inputType);
        return false;
    }
    public static Result validate(VoiceRecordDraft d,BigDecimal plotArea,LocalDateTime now) {
        List<String> missing=new ArrayList<>(),warnings=new ArrayList<>();
        if(d.plotId()==null)missing.add("请选择地块");
        if(d.operatedAt()==null)missing.add("请确认实际作业时间");
        else if(d.operatedAt().isAfter(now))missing.add("不能记录尚未发生的作业");
        if(d.operatorId()==null)missing.add("请选择实际作业人");
        if(!TYPES.contains(Objects.toString(d.operationType(),"")))missing.add("请选择农事类型");
        if(d.description()==null||d.description().isBlank())missing.add("请补充实际作业描述");
        if(d.areaMu()==null||d.areaMu().signum()<=0)missing.add("请确认正数作业面积（亩）");
        else if(plotArea==null||plotArea.signum()<=0)warnings.add("地块面积缺失，需核实地块档案");
        else if(d.areaMu().compareTo(plotArea)>0)warnings.add(d.areaMu().compareTo(plotArea.multiply(new BigDecimal("1.2")))>0?"作业面积超过地块面积20%，必须复核":"作业面积超过地块面积，必须复核");
        boolean input=Set.of("pest_control","fertilizing").contains(Objects.toString(d.operationType(),""));
        if(input&&d.inputId()==null)missing.add("投入品名称未匹配，请从现有投入品档案选择");
        if(input||"harvesting".equals(d.operationType())) {
            if(d.quantity()==null||d.quantity().signum()<=0)missing.add("用量或采收量必须为明确正数");
            if(d.unit()==null||d.unit().isBlank())missing.add("请确认数量单位");
        }
        if("ventilation".equals(d.operationType())&&(d.durationHours()==null||d.durationHours().signum()<=0))missing.add("请确认通风时长（小时）");
        if("harvesting".equals(d.operationType())&&d.batchId()==null)missing.add("采收记录须关联原采收模块已登记批次，不重复新建批次");
        if("pest_control".equals(d.operationType())) {
            warnings.add("施药登记适用范围、剂量与安全间隔须技术员人工核验（未接入权威登记库）");
            if(d.registeredMaxPerMu()==null||d.registeredMaxPerMu().signum()<=0||d.evidenceRef()==null||d.evidenceRef().isBlank())warnings.add("登记剂量依据未核验，须技术员补充依据并复核");
            else if(d.quantity()!=null&&d.areaMu()!=null&&d.areaMu().signum()>0) {
                BigDecimal limit=d.registeredMaxPerMu().multiply(d.areaMu());
                if(d.quantity().compareTo(limit.multiply(new BigDecimal("3")))>0)warnings.add("用量超过登记上限3倍，必须复核并保留异常事实");
                else if(d.quantity().compareTo(limit)>0)warnings.add("用量超过登记上限，必须复核");
            }
            if(d.safetyIntervalDays()==null||d.safetyIntervalDays()<0)warnings.add("安全间隔未知，须核实登记依据");
        }
        return new Result(missing,warnings);
    }
}
