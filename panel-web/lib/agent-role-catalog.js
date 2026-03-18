const AGENT_ROLE_CATALOG = [
  { workerId: 1, hexId: 'qian', category: '数据与研发', roleName: '数据挖掘工程师' },
  { workerId: 2, hexId: 'kun', category: '数据与研发', roleName: '数据分析工程师' },
  { workerId: 3, hexId: 'tai', category: '数据与研发', roleName: '算法工程师' },
  { workerId: 4, hexId: 'pi', category: '数据与研发', roleName: '机器学习工程师' },
  { workerId: 5, hexId: 'xun', category: '数据与研发', roleName: '后端研发工程师' },
  { workerId: 6, hexId: 'yu', category: '数据与研发', roleName: '前端研发工程师' },
  { workerId: 7, hexId: 'sui', category: '数据与研发', roleName: '全栈开发工程师' },
  { workerId: 8, hexId: 'gu', category: '数据与研发', roleName: 'DevOps工程师' },
  { workerId: 9, hexId: 'lin', category: '数据与研发', roleName: '测试开发工程师' },
  { workerId: 10, hexId: 'guan', category: '数据与研发', roleName: '技术架构师' },
  { workerId: 11, hexId: 'h11', category: '产品与设计', roleName: '产品经理' },
  { workerId: 12, hexId: 'h12', category: '产品与设计', roleName: '增长产品经理' },
  { workerId: 13, hexId: 'h13', category: '产品与设计', roleName: '用户研究员' },
  { workerId: 14, hexId: 'h14', category: '产品与设计', roleName: '交互设计师' },
  { workerId: 15, hexId: 'h15', category: '产品与设计', roleName: '视觉设计师' },
  { workerId: 16, hexId: 'h16', category: '产品与设计', roleName: '品牌设计师' },
  { workerId: 17, hexId: 'h17', category: '市场与新媒体', roleName: '新媒体运营' },
  { workerId: 18, hexId: 'h18', category: '市场与新媒体', roleName: '小红书运营' },
  { workerId: 19, hexId: 'h19', category: '市场与新媒体', roleName: '公众号写作' },
  { workerId: 20, hexId: 'h20', category: '市场与新媒体', roleName: '短视频编导' },
  { workerId: 21, hexId: 'h21', category: '市场与新媒体', roleName: '内容策划经理' },
  { workerId: 22, hexId: 'h22', category: '市场与新媒体', roleName: 'SEO内容编辑' },
  { workerId: 23, hexId: 'h23', category: '市场与新媒体', roleName: '品牌策划经理' },
  { workerId: 24, hexId: 'h24', category: '市场与新媒体', roleName: '广告投放优化师' },
  { workerId: 25, hexId: 'h25', category: '市场与新媒体', roleName: '直播运营专员' },
  { workerId: 26, hexId: 'h26', category: '市场与新媒体', roleName: '社区增长运营' },
  { workerId: 27, hexId: 'h27', category: '销售与客服', roleName: '销售经理' },
  { workerId: 28, hexId: 'h28', category: '销售与客服', roleName: '售前咨询顾问' },
  { workerId: 29, hexId: 'h29', category: '销售与客服', roleName: '客户成功经理' },
  { workerId: 30, hexId: 'h30', category: '销售与客服', roleName: '电商客服专员' },
  { workerId: 31, hexId: 'h31', category: '销售与客服', roleName: '客服质检主管' },
  { workerId: 32, hexId: 'h32', category: '销售与客服', roleName: '售后处理专员' },
  { workerId: 33, hexId: 'h33', category: '销售与客服', roleName: '投诉升级经理' },
  { workerId: 34, hexId: 'h34', category: '销售与客服', roleName: '渠道拓展经理' },
  { workerId: 35, hexId: 'h35', category: '供应链与运营', roleName: '供应链计划专员' },
  { workerId: 36, hexId: 'h36', category: '供应链与运营', roleName: '采购经理' },
  { workerId: 37, hexId: 'h37', category: '供应链与运营', roleName: '物流协调专员' },
  { workerId: 38, hexId: 'h38', category: '供应链与运营', roleName: '仓储运营经理' },
  { workerId: 39, hexId: 'h39', category: '供应链与运营', roleName: '质量管理工程师' },
  { workerId: 40, hexId: 'h40', category: '供应链与运营', roleName: '流程运营专员' },
  { workerId: 41, hexId: 'h41', category: '财务与法务', roleName: '财务分析师' },
  { workerId: 42, hexId: 'h42', category: '财务与法务', roleName: '预算管理专员' },
  { workerId: 43, hexId: 'h43', category: '财务与法务', roleName: '审计经理' },
  { workerId: 44, hexId: 'h44', category: '财务与法务', roleName: '税务顾问' },
  { workerId: 45, hexId: 'h45', category: '财务与法务', roleName: '法务顾问' },
  { workerId: 46, hexId: 'h46', category: '财务与法务', roleName: '合规经理' },
  { workerId: 47, hexId: 'h47', category: '财务与法务', roleName: '知识产权专员' },
  { workerId: 48, hexId: 'h48', category: '财务与法务', roleName: '风控策略经理' },
  { workerId: 49, hexId: 'h49', category: '教育与培训', roleName: '语文教师' },
  { workerId: 50, hexId: 'h50', category: '教育与培训', roleName: '数学教师' },
  { workerId: 51, hexId: 'h51', category: '教育与培训', roleName: '英语教师' },
  { workerId: 52, hexId: 'h52', category: '教育与培训', roleName: '物理教师' },
  { workerId: 53, hexId: 'h53', category: '教育与培训', roleName: '化学教师' },
  { workerId: 54, hexId: 'h54', category: '教育与培训', roleName: '历史教师' },
  { workerId: 55, hexId: 'h55', category: '教育与培训', roleName: '课程研发专员' },
  { workerId: 56, hexId: 'h56', category: '教育与培训', roleName: '职业规划顾问' },
  { workerId: 57, hexId: 'h57', category: '医疗与健康', roleName: '全科医生助理' },
  { workerId: 58, hexId: 'h58', category: '医疗与健康', roleName: '临床研究助理' },
  { workerId: 59, hexId: 'h59', category: '医疗与健康', roleName: '药学信息专员' },
  { workerId: 60, hexId: 'h60', category: '医疗与健康', roleName: '营养健康顾问' },
  { workerId: 61, hexId: 'h61', category: '医疗与健康', roleName: '心理咨询助理' },
  { workerId: 62, hexId: 'h62', category: '医疗与健康', roleName: '康复计划顾问' },
  { workerId: 63, hexId: 'h63', category: '战略与研究', roleName: '行业研究员' },
  { workerId: 64, hexId: 'h64', category: '战略与研究', roleName: '战略咨询顾问' },
];

const AGENT_ROLE_MAP = AGENT_ROLE_CATALOG.reduce((acc, item) => {
  acc[item.hexId] = item;
  return acc;
}, Object.create(null));

function getAgentRoleProfile(hexId) {
  return AGENT_ROLE_MAP[String(hexId || '').trim()] || null;
}

function getDefaultAgentRoleName(hexId, fallback = '') {
  return getAgentRoleProfile(hexId)?.roleName || fallback;
}

function getDefaultAgentRoleNames() {
  return AGENT_ROLE_CATALOG.map((item) => item.roleName);
}

module.exports = {
  AGENT_ROLE_CATALOG,
  AGENT_ROLE_MAP,
  getAgentRoleProfile,
  getDefaultAgentRoleName,
  getDefaultAgentRoleNames,
};
