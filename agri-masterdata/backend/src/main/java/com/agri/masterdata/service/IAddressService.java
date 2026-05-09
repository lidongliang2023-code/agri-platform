package com.agri.masterdata.service;

import com.agri.masterdata.entity.AddressRegion;
import com.agri.masterdata.entity.LogisticsNode;
import com.agri.masterdata.entity.ProductRegion;

import java.util.List;
import java.util.Map;

public interface IAddressService {

    List<AddressRegion> getRegionTree(String parentCode);

    List<AddressRegion> getByLevel(Integer level);

    AddressRegion getByRegionCode(String regionCode);

    AddressRegion getById(String regionId);

    void saveRegion(AddressRegion region);

    void updateRegion(String regionId, AddressRegion region);

    Map<String, Object> standardizeAddress(String rawAddress);

    List<String> completeAddress(String partialAddress);

    boolean validateAddress(Map<String, Object> address);

    List<ProductRegion> listProductRegions(String regionType);

    ProductRegion getProductRegionById(String regionId);

    void saveProductRegion(ProductRegion region);

    void updateProductRegion(String regionId, ProductRegion region);

    void deleteProductRegion(String regionId);

    List<LogisticsNode> listLogisticsNodes(String regionCode, String nodeType);

    LogisticsNode getLogisticsNodeById(String nodeId);

    void saveLogisticsNode(LogisticsNode node);

    void updateLogisticsNode(String nodeId, LogisticsNode node);

    void deleteLogisticsNode(String nodeId);
}