import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type NodeProps,
  type EdgeProps,
  getBezierPath,
  BaseEdge,
  EdgeLabelRenderer,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { Bot, Circle, Square, GitFork, RotateCcw, Zap } from 'lucide-react';
import type { FlowNode, FlowGraph } from '../../lib/rules';

const NODE_WIDTH = 240;
const NODE_HEIGHT = 72;

const dagreLayout = (nodes: Node[], edges: Edge[]): Node[] => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 60, marginx: 20, marginy: 20 });

  nodes.forEach((node) => {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  });
  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, { label: edge.label });
  });

  dagre.layout(g);

  return nodes.map((node) => {
    const nodeWithPos = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPos.x - NODE_WIDTH / 2,
        y: nodeWithPos.y - NODE_HEIGHT / 2,
      },
    };
  });
};

function StartNode({ data }: NodeProps) {
  return (
    <div className="group relative">
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-emerald-400 !border-2 !border-emerald-400/50" />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/40 shadow-lg shadow-emerald-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/25 to-emerald-500/10 border border-emerald-500/40 flex items-center justify-center shrink-0">
          <Circle size={18} className="text-emerald-400" fill="currentColor" />
          <div className="absolute inset-0 rounded-xl bg-emerald-400/15 animate-pulse" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">触发</div>
          <div className="text-sm text-pc-text font-medium truncate">{String(data.label || '开始')}</div>
        </div>
      </div>
    </div>
  );
}

function EndNode({ data }: NodeProps) {
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-zinc-400 !border-2 !border-zinc-400/50" />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-zinc-500/20 to-zinc-500/5 border border-zinc-500/40 shadow-lg shadow-zinc-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-500/25 to-zinc-500/10 border border-zinc-500/40 flex items-center justify-center shrink-0">
          <Square size={18} className="text-zinc-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">结束</div>
          <div className="text-sm text-pc-text font-medium truncate">{String(data.label || '结束')}</div>
        </div>
      </div>
    </div>
  );
}

function SkillNode({ data }: NodeProps) {
  const skillName = data.skillName as string | undefined;
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-cyan-400 !border-2 !border-cyan-400/50" />
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-cyan-400 !border-2 !border-cyan-400/50" />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/10 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 backdrop-blur-sm min-w-[200px]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/25 to-violet-500/10 border border-cyan-500/30 flex items-center justify-center shrink-0">
          <Bot size={18} className="text-cyan-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400">技能</span>
            {skillName && (
              <>
                <span className="text-pc-text-muted/40">·</span>
                <span className="text-[10px] text-[var(--pc-accent)] font-medium">{skillName}</span>
              </>
            )}
          </div>
          <div className="text-sm text-pc-text font-medium truncate">{String(data.label || '未命名')}</div>
        </div>
      </div>
    </div>
  );
}

function ConditionNode({ data }: NodeProps) {
  const condition = data.condition as string | undefined;
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-amber-400 !border-2 !border-amber-400/50" />
      <Handle type="source" position={Position.Bottom} id="yes" className="!w-2 !h-2 !bg-emerald-400 !border-2 !border-emerald-400/50" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="no" className="!w-2 !h-2 !bg-red-400 !border-2 !border-red-400/50" style={{ left: '70%' }} />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500/15 to-amber-500/5 border border-amber-500/40 shadow-lg shadow-amber-500/10 backdrop-blur-sm min-w-[220px]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/25 to-amber-500/10 border border-amber-500/40 flex items-center justify-center shrink-0">
          <GitFork size={18} className="text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">条件</div>
          <div className="text-sm text-pc-text font-medium truncate">{String(data.label || '条件判断')}</div>
          {condition && (
            <div className="text-[10px] text-pc-text-muted font-mono mt-0.5 truncate">{condition}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function LoopNode({ data }: NodeProps) {
  const loopConfig = data.loopConfig as { maxIterations?: number; condition?: string } | undefined;
  return (
    <div className="group relative">
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-purple-400 !border-2 !border-purple-400/50" />
      <Handle type="source" position={Position.Bottom} id="done" className="!w-2 !h-2 !bg-emerald-400 !border-2 !border-emerald-400/50" style={{ left: '30%' }} />
      <Handle type="source" position={Position.Bottom} id="loop" className="!w-2 !h-2 !bg-purple-400 !border-2 !border-purple-400/50" style={{ left: '70%' }} />
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/40 shadow-lg shadow-purple-500/10 backdrop-blur-sm min-w-[220px]">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/25 to-purple-500/10 border border-purple-500/40 flex items-center justify-center shrink-0">
          <RotateCcw size={18} className="text-purple-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">循环</span>
            {loopConfig?.maxIterations && (
              <span className="text-[10px] text-pc-text-muted">×{loopConfig.maxIterations}</span>
            )}
          </div>
          <div className="text-sm text-pc-text font-medium truncate">{String(data.label || '循环')}</div>
          {loopConfig?.condition && (
            <div className="text-[10px] text-pc-text-muted font-mono mt-0.5 truncate">{loopConfig.condition}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  start: StartNode,
  end: EndNode,
  skill: SkillNode,
  condition: ConditionNode,
  loop: LoopNode,
};

function ConditionEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, style = {} }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isPositive = String(label) === '是' || String(label) === 'yes' || String(label) === 'true' || String(label) === 'sufficient';
  const isNegative = String(label) === '否' || String(label) === 'no' || String(label) === 'false';
  const isLoop = String(label) === '循环' || String(label) === 'loop' || String(label) === 'retry';

  const edgeColor = isPositive
    ? '#34d399'
    : isNegative
      ? '#f87171'
      : isLoop
        ? '#a78bfa'
        : undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ ...style, stroke: edgeColor || style.stroke, strokeWidth: 2 }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isNegative
                  ? 'bg-red-500/10 text-red-400 border-red-500/30'
                  : isLoop
                    ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                    : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
            }`}
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

function LoopBackEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, label, style = {} }: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ ...style, stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: '6 3' }} />
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 whitespace-nowrap"
          >
            {String(label)}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const edgeTypes: EdgeTypes = {
  condition: ConditionEdge,
  loopback: LoopBackEdge,
};

function rebuildFlowEdges(nodes: FlowNode[]): Edge[] {
  const sorted = [...nodes].sort((a, b) => (a.index || 0) - (b.index || 0));
  const edges: Edge[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const curr = sorted[i];
    const next = sorted[i + 1];
    if (curr.type === 'end') continue;
    if (curr.type === 'condition') {
      const branchYes = sorted[i + 1];
      const branchNo = sorted[i + 2];
      if (branchYes) edges.push({ id: `e-${curr.id}-${branchYes.id}`, source: curr.id, target: branchYes.id, label: '是', type: 'condition', style: { stroke: '#34d399', strokeWidth: 2 } });
      if (branchNo) edges.push({ id: `e-${curr.id}-${branchNo.id}`, source: curr.id, target: branchNo.id, label: '否', type: 'condition', style: { stroke: '#f87171', strokeWidth: 2 } });
      if (branchNo) i++;
    } else if (curr.type === 'loop') {
      const loopBody = sorted[i + 1];
      const afterLoop = sorted[i + 2];
      if (loopBody) edges.push({ id: `e-${curr.id}-${loopBody.id}`, source: curr.id, target: loopBody.id, label: '循环', type: 'loopback', style: { stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: '6 3' }, animated: true });
      if (afterLoop) edges.push({ id: `e-${curr.id}-${afterLoop.id}`, source: curr.id, target: afterLoop.id, label: '完成', type: 'default', style: { stroke: '#64748b', strokeWidth: 1.5 } });
      if (afterLoop) i++;
    } else if (next) {
      edges.push({ id: `e-${curr.id}-${next.id}`, source: curr.id, target: next.id, label: undefined, type: 'default', style: { stroke: '#64748b', strokeWidth: 1.5 } });
    }
  }
  return edges;
}

interface FlowGraphViewProps {
  flow: FlowGraph;
}

export function FlowGraphView({ flow }: FlowGraphViewProps) {
  const convertFlow = useCallback(() => {
    const { nodes: flowNodes, edges: flowEdges } = flow;

    const rfNodes: Node[] = flowNodes.map((node: FlowNode) => {
      const nodeType = node.type === 'start' ? 'start'
        : node.type === 'end' ? 'end'
        : node.type === 'condition' ? 'condition'
        : node.type === 'loop' ? 'loop'
        : 'skill';

      return {
        id: node.id,
        type: nodeType,
        position: { x: 0, y: 0 },
        data: {
          label: node.label || '未命名',
          skillId: node.skillId,
          skillName: node.skillName,
          condition: node.expression || node.condition,
          loopConfig: node.loopConfig,
          input: node.input,
          output: node.output,
          index: node.index,
        },
      };
    });

    const validEdges = flowEdges.filter((e: any) => e.source && e.target);
    let rfEdges: Edge[] = [];

    if (validEdges.length > 0) {
      rfEdges = validEdges.map((edge: any, idx) => {
        const sourceNode = flowNodes.find((n: FlowNode) => n.id === edge.source);
        const isLoopBack = sourceNode?.type === 'loop' && (edge.label === '循环' || edge.label === 'loop' || edge.label === 'retry' || edge.target === edge.source);
        const isConditionEdge = sourceNode?.type === 'condition';

        let resolvedLabel = edge.label;
        if (!resolvedLabel && edge.condition) {
          resolvedLabel = edge.condition === 'true' ? '是' : edge.condition === 'false' ? '否' : edge.condition;
        }

        let sourceHandle: string | undefined;
        if (sourceNode?.type === 'condition') {
          sourceHandle = resolvedLabel === '是' || resolvedLabel === 'yes' || resolvedLabel === 'true' || resolvedLabel === 'sufficient' ? 'yes' : 'no';
        } else if (sourceNode?.type === 'loop') {
          sourceHandle = isLoopBack ? 'loop' : 'done';
        }

        return {
          id: edge.id || `e-${idx}`,
          source: edge.source,
          target: edge.target,
          label: resolvedLabel,
          type: isLoopBack ? 'loopback' : isConditionEdge ? 'condition' : 'default',
          sourceHandle,
          animated: isLoopBack,
          style: isConditionEdge
            ? { stroke: '#94a3b8', strokeWidth: 2 }
            : isLoopBack
              ? { stroke: '#a78bfa', strokeWidth: 2, strokeDasharray: '6 3' }
              : { stroke: '#64748b', strokeWidth: 1.5 },
        };
      });
    } else if (rfNodes.length > 1) {
      rfEdges = rebuildFlowEdges(flowNodes);
    }

    const layoutedNodes = dagreLayout(rfNodes, rfEdges);

    return { nodes: layoutedNodes, edges: rfEdges };
  }, [flow]);

  const { nodes, edges } = useMemo(() => convertFlow(), [convertFlow]);

  if (flow.nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Zap size={48} className="text-pc-text-muted/30 mb-4" />
        <p className="text-pc-text-muted text-sm">暂无流程节点</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] min-h-[400px] w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="rounded-2xl"
        style={{ background: 'var(--pc-bg-base)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--pc-border)" />
        <Controls
          showInteractive={false}
          className="!bg-[var(--pc-bg-surface)] !border-pc-border !rounded-xl !shadow-lg"
        />
      </ReactFlow>
    </div>
  );
}
