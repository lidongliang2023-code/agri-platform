package com.agri.trade.service;

import com.agri.trade.entity.Demand;

public interface INlpParseService {

    Demand parseNaturalLanguage(String naturalText, Long userId);

    ParsedDemandResult parseAndExtract(String naturalText);

    String extractProductName(String text);

    String extractQuantity(String text);

    String extractPrice(String text);

    String extractLocation(String text);

    String extractTime(String text);

    String extractQuality(String text);

    static class ParsedDemandResult {
        private String productName;
        private String quantity;
        private String unit;
        private String price;
        private String location;
        private String timeRange;
        private String quality;
        private String additionalRequirements;

        public String getProductName() { return productName; }
        public void setProductName(String productName) { this.productName = productName; }
        public String getQuantity() { return quantity; }
        public void setQuantity(String quantity) { this.quantity = quantity; }
        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }
        public String getPrice() { return price; }
        public void setPrice(String price) { this.price = price; }
        public String getLocation() { return location; }
        public void setLocation(String location) { this.location = location; }
        public String getTimeRange() { return timeRange; }
        public void setTimeRange(String timeRange) { this.timeRange = timeRange; }
        public String getQuality() { return quality; }
        public void setQuality(String quality) { this.quality = quality; }
        public String getAdditionalRequirements() { return additionalRequirements; }
        public void setAdditionalRequirements(String additionalRequirements) { this.additionalRequirements = additionalRequirements; }
    }
}