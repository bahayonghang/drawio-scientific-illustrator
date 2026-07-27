export default {
  title: 'Draw.io Scientific Illustrator',
  description: 'AI-powered live scientific figure illustration inside visible draw.io desktop',
  cleanUrls: true,
  ignoreDeadLinks: true,
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico' }]
  ],
  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: [
          { text: 'Home', link: '/' },
          { text: 'Guide', link: '/guide/introduction' },
          { text: 'Workflow', link: '/guide/usage' },
          { text: 'GitHub', link: 'https://github.com/icebird1998/drawio-scientific-illustrator' }
        ],
        sidebar: [
          {
            text: 'Getting Started',
            items: [
              { text: 'Introduction', link: '/guide/introduction' },
              { text: 'Quick Start & Installation', link: '/guide/getting-started' }
            ]
          },
          {
            text: 'Core Concepts',
            items: [
              { text: 'Usage & Paced Workflow', link: '/guide/usage' },
              { text: 'Configuration', link: '/guide/configuration' },
              { text: 'Troubleshooting & FAQ', link: '/guide/troubleshooting' }
            ]
          },
          {
            text: 'Advanced & Migration',
            items: [
              { text: 'Migration from Global Plugin', link: '/guide/migration' },
              { text: 'Project-Local Installation', link: '/guide/project-local' }
            ]
          }
        ]
      }
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '使用指南', link: '/zh/guide/introduction' },
          { text: '工作流程', link: '/zh/guide/usage' },
          { text: 'GitHub', link: 'https://github.com/icebird1998/drawio-scientific-illustrator' }
        ],
        sidebar: [
          {
            text: '新手指南',
            items: [
              { text: '项目介绍与原理', link: '/zh/guide/introduction' },
              { text: '快速开始与安装', link: '/zh/guide/getting-started' }
            ]
          },
          {
            text: '核心功能',
            items: [
              { text: '使用教程与步进绘图', link: '/zh/guide/usage' },
              { text: '环境变量与配置', link: '/zh/guide/configuration' },
              { text: '故障排查与 FAQ', link: '/zh/guide/troubleshooting' }
            ]
          },
          {
            text: '高级应用',
            items: [
              { text: '从全局插件迁移', link: '/zh/guide/migration' },
              { text: '项目级本地安装指南', link: '/zh/guide/project-local' }
            ]
          }
        ]
      }
    }
  },
  themeConfig: {
    socialLinks: [
      { icon: 'github', link: 'https://github.com/icebird1998/drawio-scientific-illustrator' }
    ],
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 icebird1998'
    }
  }
}
