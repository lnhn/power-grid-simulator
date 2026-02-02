import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // 创建测试用户
  const hashedPassword = await bcrypt.hash('password', 10)

  const engineer = await prisma.user.upsert({
    where: { username: 'engineer' },
    update: {},
    create: {
      username: 'engineer',
      password: hashedPassword,
      role: 'ENGINEER',
    },
  })

  const operator = await prisma.user.upsert({
    where: { username: 'operator' },
    update: {},
    create: {
      username: 'operator',
      password: hashedPassword,
      role: 'OPERATOR',
    },
  })

  // 创建示例电网
  const sampleGrid = await prisma.powerGrid.upsert({
    where: { id: 'sample-grid' },
    update: {},
    create: {
      id: 'sample-grid',
      name: '示例电网 - 车间A',
      description: '包含三相电源、断路器保护和多种用电设备的典型工业电网',
      nodes: JSON.stringify([
        {
          id: 'power_1',
          type: 'powerSource',
          position: { x: 500, y: 80 },
          data: { label: '主电源', status: 'normal', voltage: 380 },
        },
        {
          id: 'switch_main',
          type: 'switch',
          position: { x: 500, y: 220 },
          data: { label: '主断路器', status: 'off' },
        },
        {
          id: 'bus_1',
          type: 'bus',
          position: { x: 500, y: 360 },
          data: { label: '主配电母线' },
        },
        {
          id: 'switch_left',
          type: 'switch',
          position: { x: 200, y: 500 },
          data: { label: '分支1断路器', status: 'off' },
        },
        {
          id: 'switch_center',
          type: 'switch',
          position: { x: 500, y: 500 },
          data: { label: '分支2断路器', status: 'off' },
        },
        {
          id: 'switch_right',
          type: 'switch',
          position: { x: 800, y: 500 },
          data: { label: '分支3断路器', status: 'off' },
        },
        {
          id: 'load_pump',
          type: 'load',
          position: { x: 180, y: 660 },
          data: { label: '循环水泵', power: 75, subType: 'pump', status: 'stopped' },
        },
        {
          id: 'load_fan',
          type: 'load',
          position: { x: 475, y: 660 },
          data: { label: '通风风机', power: 55, subType: 'fan', status: 'stopped' },
        },
        {
          id: 'load_compressor',
          type: 'load',
          position: { x: 770, y: 660 },
          data: { label: '空气压缩机', power: 90, subType: 'compressor', status: 'stopped' },
        },
      ]),
      edges: JSON.stringify([
        {
          id: 'e1',
          source: 'power_1',
          target: 'switch_main',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
        {
          id: 'e2',
          source: 'switch_main',
          target: 'bus_1',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
        {
          id: 'e3',
          source: 'bus_1',
          target: 'switch_left',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
        {
          id: 'e4',
          source: 'bus_1',
          target: 'switch_center',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
        {
          id: 'e5',
          source: 'bus_1',
          target: 'switch_right',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
        {
          id: 'e6',
          source: 'switch_left',
          target: 'load_pump',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
        {
          id: 'e7',
          source: 'switch_center',
          target: 'load_fan',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
        {
          id: 'e8',
          source: 'switch_right',
          target: 'load_compressor',
          type: 'smoothstep',
          markerEnd: { type: 'arrowclosed' },
          style: { strokeWidth: 2, stroke: '#64748b' },
        },
      ]),
    },
  })

  console.log('数据库初始化完成!')
  console.log('创建的用户:')
  console.log('  工程师 - 用户名: engineer, 密码: password')
  console.log('  操作员 - 用户名: operator, 密码: password')
  console.log('创建的示例电网:', sampleGrid.name)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
