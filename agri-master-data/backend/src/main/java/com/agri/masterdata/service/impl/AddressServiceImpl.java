package com.agri.masterdata.service.impl;

import com.agri.common.exception.BusinessException;
import com.agri.masterdata.entity.AddressRegion;
import com.agri.masterdata.entity.LogisticsNode;
import com.agri.masterdata.entity.ProductRegion;
import com.agri.masterdata.mapper.AddressRegionMapper;
import com.agri.masterdata.mapper.LogisticsNodeMapper;
import com.agri.masterdata.mapper.ProductRegionMapper;
import com.agri.masterdata.service.IAddressService;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AddressServiceImpl implements IAddressService {

    private final AddressRegionMapper addressRegionMapper;
    private final ProductRegionMapper productRegionMapper;
    private final LogisticsNodeMapper logisticsNodeMapper;

    @Override
    public List<AddressRegion> getRegionTree(String parentCode) {
        String searchParentCode = parentCode == null ? "100000" : parentCode;
        List<AddressRegion> regions = addressRegionMapper.selectByParentCode(searchParentCode);
        return regions.stream()
                .peek(r -> r.setChildren(buildRegionTree(r.getRegionCode())))
                .collect(Collectors.toList());
    }

    @Override
    public List<AddressRegion> getByLevel(Integer level) {
        return addressRegionMapper.selectByLevel(level);
    }

    @Override
    public AddressRegion getByRegionCode(String regionCode) {
        return addressRegionMapper.selectByRegionCode(regionCode);
    }

    @Override
    public AddressRegion getById(String regionId) {
        AddressRegion region = addressRegionMapper.selectById(regionId);
        if (region == null) {
            throw new BusinessException("区域不存在");
        }
        return region;
    }

    @Override
    @Transactional
    public void saveRegion(AddressRegion region) {
        addressRegionMapper.insert(region);
    }

    @Override
    @Transactional
    public void updateRegion(String regionId, AddressRegion region) {
        AddressRegion existing = addressRegionMapper.selectById(regionId);
        if (existing == null) {
            throw new BusinessException("区域不存在");
        }
        region.setRegionId(regionId);
        addressRegionMapper.updateById(region);
    }

    @Override
    public Map<String, Object> standardizeAddress(String rawAddress) {
        Map<String, Object> result = new HashMap<>();
        result.put("province", "");
        result.put("city", "");
        result.put("district", "");
        result.put("detail", "");
        result.put("standardized", rawAddress);
        return result;
    }

    @Override
    public List<String> completeAddress(String partialAddress) {
        return Arrays.asList(partialAddress + " 北京市朝阳区", partialAddress + " 上海市浦东新区");
    }

    @Override
    public boolean validateAddress(Map<String, Object> address) {
        String province = (String) address.get("province");
        String city = (String) address.get("city");
        return province != null && !province.isEmpty() && city != null && !city.isEmpty();
    }

    @Override
    public List<ProductRegion> listProductRegions(String regionType) {
        if (regionType != null && !regionType.isEmpty()) {
            return productRegionMapper.selectByType(regionType);
        }
        LambdaQueryWrapper<ProductRegion> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ProductRegion::getStatus, "enabled");
        return productRegionMapper.selectList(wrapper);
    }

    @Override
    public ProductRegion getProductRegionById(String regionId) {
        ProductRegion region = productRegionMapper.selectById(regionId);
        if (region == null) {
            throw new BusinessException("产区不存在");
        }
        return region;
    }

    @Override
    @Transactional
    public void saveProductRegion(ProductRegion region) {
        region.setCreateTime(LocalDateTime.now());
        region.setStatus("enabled");
        productRegionMapper.insert(region);
    }

    @Override
    @Transactional
    public void updateProductRegion(String regionId, ProductRegion region) {
        ProductRegion existing = productRegionMapper.selectById(regionId);
        if (existing == null) {
            throw new BusinessException("产区不存在");
        }
        region.setRegionId(regionId);
        productRegionMapper.updateById(region);
    }

    @Override
    @Transactional
    public void deleteProductRegion(String regionId) {
        ProductRegion region = productRegionMapper.selectById(regionId);
        if (region == null) {
            throw new BusinessException("产区不存在");
        }
        productRegionMapper.deleteById(regionId);
    }

    @Override
    public List<LogisticsNode> listLogisticsNodes(String regionCode, String nodeType) {
        LambdaQueryWrapper<LogisticsNode> wrapper = new LambdaQueryWrapper<>();
        if (regionCode != null && !regionCode.isEmpty()) {
            wrapper.eq(LogisticsNode::getRegionCode, regionCode);
        }
        if (nodeType != null && !nodeType.isEmpty()) {
            wrapper.eq(LogisticsNode::getNodeType, nodeType);
        }
        wrapper.eq(LogisticsNode::getStatus, "enabled");
        return logisticsNodeMapper.selectList(wrapper);
    }

    @Override
    public LogisticsNode getLogisticsNodeById(String nodeId) {
        LogisticsNode node = logisticsNodeMapper.selectById(nodeId);
        if (node == null) {
            throw new BusinessException("物流节点不存在");
        }
        return node;
    }

    @Override
    @Transactional
    public void saveLogisticsNode(LogisticsNode node) {
        node.setStatus("enabled");
        logisticsNodeMapper.insert(node);
    }

    @Override
    @Transactional
    public void updateLogisticsNode(String nodeId, LogisticsNode node) {
        LogisticsNode existing = logisticsNodeMapper.selectById(nodeId);
        if (existing == null) {
            throw new BusinessException("物流节点不存在");
        }
        node.setNodeId(nodeId);
        logisticsNodeMapper.updateById(node);
    }

    @Override
    @Transactional
    public void deleteLogisticsNode(String nodeId) {
        LogisticsNode node = logisticsNodeMapper.selectById(nodeId);
        if (node == null) {
            throw new BusinessException("物流节点不存在");
        }
        logisticsNodeMapper.deleteById(nodeId);
    }

    private List<AddressRegion> buildRegionTree(String parentCode) {
        List<AddressRegion> children = addressRegionMapper.selectByParentCode(parentCode);
        return children.stream()
                .peek(c -> c.setChildren(buildRegionTree(c.getRegionCode())))
                .collect(Collectors.toList());
    }
}