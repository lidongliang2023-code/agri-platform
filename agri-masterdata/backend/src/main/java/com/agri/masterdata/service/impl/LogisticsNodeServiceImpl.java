package com.agri.masterdata.service.impl;

import com.agri.common.entity.PageResult;
import com.agri.common.exception.BusinessException;
import com.agri.common.util.BeanCopyUtils;
import com.agri.masterdata.dto.LogisticsNodeSaveDTO;
import com.agri.masterdata.dto.LogisticsNodeUpdateDTO;
import com.agri.masterdata.entity.LogisticsNode;
import com.agri.masterdata.mapper.LogisticsNodeMapper;
import com.agri.masterdata.service.ILogisticsNodeService;
import com.agri.masterdata.vo.LogisticsNodeVO;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LogisticsNodeServiceImpl implements ILogisticsNodeService {

    private final LogisticsNodeMapper logisticsNodeMapper;

    @Override
    public PageResult<LogisticsNodeVO> page(Integer pageNum, Integer pageSize, String nodeName, String nodeType) {
        LambdaQueryWrapper<LogisticsNode> wrapper = new LambdaQueryWrapper<>();
        if (nodeName != null && !nodeName.isEmpty()) {
            wrapper.like(LogisticsNode::getNodeName, nodeName);
        }
        if (nodeType != null && !nodeType.isEmpty()) {
            wrapper.eq(LogisticsNode::getNodeType, nodeType);
        }
        List<LogisticsNode> list = logisticsNodeMapper.selectList(wrapper);
        int start = (pageNum - 1) * pageSize;
        int end = Math.min(start + pageSize, list.size());
        List<LogisticsNodeVO> pageList = BeanCopyUtils.copyList(list.subList(start, end), LogisticsNodeVO.class);
        return new PageResult<>(pageList, (long) list.size(), (long) pageNum, (long) pageSize);
    }

    @Override
    public List<LogisticsNodeVO> listByRegionCode(String regionCode) {
        List<LogisticsNode> list = logisticsNodeMapper.selectByRegionCode(regionCode);
        return BeanCopyUtils.copyList(list, LogisticsNodeVO.class);
    }

    @Override
    public List<LogisticsNodeVO> listByNodeType(String nodeType) {
        List<LogisticsNode> list = logisticsNodeMapper.selectByNodeType(nodeType);
        return BeanCopyUtils.copyList(list, LogisticsNodeVO.class);
    }

    @Override
    public LogisticsNodeVO getById(String nodeId) {
        LogisticsNode node = logisticsNodeMapper.selectById(nodeId);
        if (node == null) {
            throw new BusinessException("物流节点不存在");
        }
        return BeanCopyUtils.copy(node, LogisticsNodeVO.class);
    }

    @Override
    public LogisticsNodeVO getByNodeCode(String nodeCode) {
        LogisticsNode node = logisticsNodeMapper.selectByNodeCode(nodeCode);
        if (node == null) {
            return null;
        }
        return BeanCopyUtils.copy(node, LogisticsNodeVO.class);
    }

    @Override
    @Transactional
    public void save(LogisticsNodeSaveDTO dto) {
        LogisticsNode existing = logisticsNodeMapper.selectByNodeCode(dto.getNodeCode());
        if (existing != null) {
            throw new BusinessException("节点编码已存在");
        }

        LogisticsNode node = BeanCopyUtils.copy(dto, LogisticsNode.class);
        node.setNodeId(UUID.randomUUID().toString());
        logisticsNodeMapper.insert(node);
    }

    @Override
    @Transactional
    public void update(String nodeId, LogisticsNodeUpdateDTO dto) {
        LogisticsNode node = logisticsNodeMapper.selectById(nodeId);
        if (node == null) {
            throw new BusinessException("物流节点不存在");
        }

        BeanCopyUtils.copyProperties(dto, node);
        logisticsNodeMapper.updateById(node);
    }

    @Override
    @Transactional
    public void delete(String nodeId) {
        LogisticsNode node = logisticsNodeMapper.selectById(nodeId);
        if (node == null) {
            throw new BusinessException("物流节点不存在");
        }
        logisticsNodeMapper.deleteById(nodeId);
    }

    @Override
    @Transactional
    public void changeStatus(String nodeId, String status) {
        LogisticsNode node = logisticsNodeMapper.selectById(nodeId);
        if (node == null) {
            throw new BusinessException("物流节点不存在");
        }

        node.setStatus(status);
        logisticsNodeMapper.updateById(node);
    }
}