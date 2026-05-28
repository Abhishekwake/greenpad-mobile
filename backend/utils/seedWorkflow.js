const WorkflowTemplate = require('../models/WorkflowTemplate');
const Role = require('../models/Role');

const DEFAULT_STAGES = [
  {
    stageId: 'stage_1',
    name: 'Document Collection',
    order: 1,
    visibleToCustomer: true,
    tasks: [
      {
        taskId: 'task_1_1',
        name: 'Aadhaar + electricity bill',
        assignedRole: 'Documentation Executive',
        docRequired: true,
      },
      {
        taskId: 'task_1_2',
        name: 'Bank account verification',
        assignedRole: 'Loan Officer',
        docRequired: false,
      },
      {
        taskId: 'task_1_3',
        name: 'Property ownership proof',
        assignedRole: 'Documentation Executive',
        docRequired: true,
      },
    ],
  },
  {
    stageId: 'stage_2',
    name: 'Site Survey',
    order: 2,
    visibleToCustomer: true,
    tasks: [
      {
        taskId: 'task_2_1',
        name: 'Roof measurement + photos',
        assignedRole: 'Site Inspector',
        docRequired: true,
      },
      {
        taskId: 'task_2_2',
        name: 'Electrical load assessment',
        assignedRole: 'Electrician',
        docRequired: false,
      },
    ],
  },
  {
    stageId: 'stage_3',
    name: 'Loan & Subsidy',
    order: 3,
    visibleToCustomer: false,
    tasks: [
      {
        taskId: 'task_3_1',
        name: 'Loan application',
        assignedRole: 'Loan Officer',
        docRequired: false,
      },
      {
        taskId: 'task_3_2',
        name: 'Government subsidy form',
        assignedRole: 'Loan Officer',
        docRequired: true,
      },
      {
        taskId: 'task_3_3',
        name: 'Bank approval follow-up',
        assignedRole: 'Loan Officer',
        docRequired: false,
      },
    ],
  },
  {
    stageId: 'stage_4',
    name: 'Installation',
    order: 4,
    visibleToCustomer: true,
    tasks: [
      {
        taskId: 'task_4_1',
        name: 'Structure fitting',
        assignedRole: 'Installation Lead',
        docRequired: false,
      },
      {
        taskId: 'task_4_2',
        name: 'Panel mounting + DC wiring',
        assignedRole: 'Installation Lead',
        docRequired: true,
      },
      {
        taskId: 'task_4_3',
        name: 'Inverter setup',
        assignedRole: 'Electrician',
        docRequired: false,
      },
    ],
  },
  {
    stageId: 'stage_5',
    name: 'Net Metering',
    order: 5,
    visibleToCustomer: true,
    tasks: [
      {
        taskId: 'task_5_1',
        name: 'MSEDCL application',
        assignedRole: 'Net Meter Agent',
        docRequired: true,
      },
      {
        taskId: 'task_5_2',
        name: 'Meter installation',
        assignedRole: 'Net Meter Agent',
        docRequired: false,
      },
    ],
  },
  {
    stageId: 'stage_6',
    name: 'Handover & Activation',
    order: 6,
    visibleToCustomer: true,
    tasks: [
      {
        taskId: 'task_6_1',
        name: 'Final QA inspection',
        assignedRole: 'QA Inspector',
        docRequired: true,
      },
      {
        taskId: 'task_6_2',
        name: 'Customer walkthrough',
        assignedRole: 'Installation Lead',
        docRequired: false,
      },
    ],
  },
];

const DEFAULT_ROLES = [
  'Documentation Executive',
  'Site Inspector',
  'Loan Officer',
  'Installation Lead',
  'Net Meter Agent',
  'Electrician',
  'QA Inspector',
];

async function seedWorkflow() {
  const existingTemplate = await WorkflowTemplate.findOne({ tenantId: 'greenpad' });
  if (!existingTemplate) {
    await WorkflowTemplate.create({
      tenantId: 'greenpad',
      name: 'Default Solar Workflow',
      stages: DEFAULT_STAGES,
    });
    console.log('Seeded default workflow template');
  }

  const roleCount = await Role.countDocuments({ tenantId: 'greenpad' });
  if (roleCount === 0) {
    await Role.insertMany(
      DEFAULT_ROLES.map((name) => ({
        tenantId: 'greenpad',
        name,
        isActive: true,
      }))
    );
    console.log(`Seeded ${DEFAULT_ROLES.length} default roles`);
  }
}

module.exports = seedWorkflow;
