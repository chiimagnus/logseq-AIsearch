module.exports = {
  branches: [
    // master 分支默认发布 pre-release 版本
    {
      name: "master",
      prerelease: "beta"
    }
  ],
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
      },
    ],
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/npm",
      {
        npmPublish: false,
      },
    ],
    "@semantic-release/git",
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          "zip -qq -r logseq-ai-search-${nextRelease.version}.zip dist readme.md logo.svg LICENSE package.json -x '*.mp4'",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: "logseq-ai-search-*.zip",
      },
    ],
  ],
};
