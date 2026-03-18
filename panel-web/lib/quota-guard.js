const quotaRepo = require('./quota-repo');

class QuotaGuard {
  async ensureTenantDefaults(tenantId, planCode = 'free') {
    return quotaRepo.ensureDefaultQuota(tenantId, planCode);
  }

  async getQuota(tenantId) {
    return quotaRepo.getQuota(tenantId);
  }

  async setQuota(tenantId, patch) {
    return quotaRepo.upsertQuota(tenantId, patch || {});
  }

  async reserveTaskDispatch(tenantId, options = {}) {
    const result = await quotaRepo.reserveTaskQuota(tenantId, options);
    if (!result.ok) {
      await quotaRepo.insertBillingEvent({
        tenantId,
        eventType: 'quota.task_dispatch.rejected',
        units: 1,
        unitPriceUsd: 0,
        totalCostUsd: 0,
        metadata: {
          code: result.code,
          reason: result.reason,
        },
      });
      return result;
    }
    await quotaRepo.insertBillingEvent({
      tenantId,
      eventType: 'quota.task_dispatch.accepted',
      units: 1,
      unitPriceUsd: 0,
      totalCostUsd: 0,
      metadata: {
        usage: result.usage,
      },
    });
    return result;
  }

  async recordTaskCompletion(tenantId, taskId, status, metadata = {}) {
    await quotaRepo.insertBillingEvent({
      tenantId,
      eventType: 'task.completed',
      units: 1,
      unitPriceUsd: 0,
      totalCostUsd: 0,
      metadata: {
        taskId,
        status,
        ...metadata,
      },
    });
  }
}

module.exports = {
  QuotaGuard,
};
