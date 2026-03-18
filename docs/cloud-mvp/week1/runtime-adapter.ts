export type RuntimeMode = 'local' | 'k8s';
export type RuntimeStatus = 'creating' | 'running' | 'stopped' | 'failed';

export interface RuntimeSpec {
  runtimeId: string;
  tenantId: string;
  mode: RuntimeMode;
  region: string;
  desiredAgents: number;
  provider: string;
  modelPrimary: string;
}

export interface RuntimeAgent {
  id: string;
  runtimeId: string;
  agentKey: string; // main, qian, kun, ...
  role: 'coordinator' | 'worker';
  status: 'pending' | 'running' | 'failed' | 'stopped';
  endpoint?: string;
}

export interface RuntimeState {
  runtimeId: string;
  status: RuntimeStatus;
  gatewayUrl?: string;
  runningAgents: number;
  desiredAgents: number;
}

export interface SecretBundle {
  provider: string;
  apiKeyCiphertext: Buffer;
  dekWrapped: Buffer;
  version: number;
}

export interface ModelPolicy {
  provider: string;
  modelPrimary: string;
  modelFallbacks?: string[];
  extra?: Record<string, unknown>;
}

export interface RuntimeAdapter {
  createRuntime(spec: RuntimeSpec): Promise<RuntimeState>;
  startRuntime(runtimeId: string): Promise<RuntimeState>;
  stopRuntime(runtimeId: string): Promise<RuntimeState>;
  scaleRuntime(runtimeId: string, desiredAgents: number): Promise<RuntimeState>;
  getRuntime(runtimeId: string): Promise<RuntimeState | null>;
  listAgents(runtimeId: string): Promise<RuntimeAgent[]>;

  syncSecrets(runtimeId: string, secrets: SecretBundle[]): Promise<void>;
  applyModelPolicy(runtimeId: string, policy: ModelPolicy): Promise<void>;

  resolveAgentEndpoint(runtimeId: string, agentKey: string): Promise<string | null>;
  healthCheck(runtimeId: string): Promise<{ ok: boolean; reason?: string }>;
}

export class LocalRuntimeAdapter implements RuntimeAdapter {
  async createRuntime(_spec: RuntimeSpec): Promise<RuntimeState> {
    throw new Error('not implemented: LocalRuntimeAdapter.createRuntime');
  }
  async startRuntime(_runtimeId: string): Promise<RuntimeState> {
    throw new Error('not implemented: LocalRuntimeAdapter.startRuntime');
  }
  async stopRuntime(_runtimeId: string): Promise<RuntimeState> {
    throw new Error('not implemented: LocalRuntimeAdapter.stopRuntime');
  }
  async scaleRuntime(_runtimeId: string, _desiredAgents: number): Promise<RuntimeState> {
    throw new Error('not implemented: LocalRuntimeAdapter.scaleRuntime');
  }
  async getRuntime(_runtimeId: string): Promise<RuntimeState | null> {
    throw new Error('not implemented: LocalRuntimeAdapter.getRuntime');
  }
  async listAgents(_runtimeId: string): Promise<RuntimeAgent[]> {
    throw new Error('not implemented: LocalRuntimeAdapter.listAgents');
  }
  async syncSecrets(_runtimeId: string, _secrets: SecretBundle[]): Promise<void> {
    throw new Error('not implemented: LocalRuntimeAdapter.syncSecrets');
  }
  async applyModelPolicy(_runtimeId: string, _policy: ModelPolicy): Promise<void> {
    throw new Error('not implemented: LocalRuntimeAdapter.applyModelPolicy');
  }
  async resolveAgentEndpoint(_runtimeId: string, _agentKey: string): Promise<string | null> {
    throw new Error('not implemented: LocalRuntimeAdapter.resolveAgentEndpoint');
  }
  async healthCheck(_runtimeId: string): Promise<{ ok: boolean; reason?: string }> {
    throw new Error('not implemented: LocalRuntimeAdapter.healthCheck');
  }
}

export class K8sRuntimeAdapter implements RuntimeAdapter {
  async createRuntime(_spec: RuntimeSpec): Promise<RuntimeState> {
    throw new Error('not implemented: K8sRuntimeAdapter.createRuntime');
  }
  async startRuntime(_runtimeId: string): Promise<RuntimeState> {
    throw new Error('not implemented: K8sRuntimeAdapter.startRuntime');
  }
  async stopRuntime(_runtimeId: string): Promise<RuntimeState> {
    throw new Error('not implemented: K8sRuntimeAdapter.stopRuntime');
  }
  async scaleRuntime(_runtimeId: string, _desiredAgents: number): Promise<RuntimeState> {
    throw new Error('not implemented: K8sRuntimeAdapter.scaleRuntime');
  }
  async getRuntime(_runtimeId: string): Promise<RuntimeState | null> {
    throw new Error('not implemented: K8sRuntimeAdapter.getRuntime');
  }
  async listAgents(_runtimeId: string): Promise<RuntimeAgent[]> {
    throw new Error('not implemented: K8sRuntimeAdapter.listAgents');
  }
  async syncSecrets(_runtimeId: string, _secrets: SecretBundle[]): Promise<void> {
    throw new Error('not implemented: K8sRuntimeAdapter.syncSecrets');
  }
  async applyModelPolicy(_runtimeId: string, _policy: ModelPolicy): Promise<void> {
    throw new Error('not implemented: K8sRuntimeAdapter.applyModelPolicy');
  }
  async resolveAgentEndpoint(_runtimeId: string, _agentKey: string): Promise<string | null> {
    throw new Error('not implemented: K8sRuntimeAdapter.resolveAgentEndpoint');
  }
  async healthCheck(_runtimeId: string): Promise<{ ok: boolean; reason?: string }> {
    throw new Error('not implemented: K8sRuntimeAdapter.healthCheck');
  }
}
