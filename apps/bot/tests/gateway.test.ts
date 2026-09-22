import { describe, it, expect } from "vitest";
import {
  isChatOpsCommand,
  isAuthorizedSender,
  buildIssuePayload,
} from "../src/gateway/filter.js";

describe("@repoclaw/bot ChatOps 网关与权限过滤器测试", () => {
  describe("1. ChatOps 指令匹配测试", () => {
    it("应正确识别标准 @repoclaw repro 与 @repoclaw-app repro 触发指令", () => {
      expect(isChatOpsCommand("@repoclaw repro")).toBe(true);
      expect(isChatOpsCommand("@repoclaw-app repro")).toBe(true);
      expect(isChatOpsCommand("@repoclaw-app[bot] repro")).toBe(true);
      expect(isChatOpsCommand("@repoclaw repro please help verify")).toBe(true);
      expect(isChatOpsCommand("@repoclaw-app repro 请协助复现")).toBe(true);
      expect(isChatOpsCommand("Hey @repoclaw repro this bug")).toBe(true);
    });

    it("应支持不区分大小写匹配", () => {
      expect(isChatOpsCommand("@REPOCLAW REPRO")).toBe(true);
      expect(isChatOpsCommand("@RepoClaw Repro")).toBe(true);
    });

    it("对非复现指令或普通聊天内容应拒绝匹配", () => {
      expect(isChatOpsCommand("can someone check this?")).toBe(false);
      expect(isChatOpsCommand("@repoclaw fix this issue")).toBe(false);
      expect(isChatOpsCommand("@repoclaw help")).toBe(false);
      expect(isChatOpsCommand("")).toBe(false);
      expect(isChatOpsCommand(null)).toBe(false);
    });
  });

  describe("2. 角色鉴权白名单测试 (防刷单与 Token 滥用)", () => {
    it("仅允许 OWNER / MEMBER / COLLABORATOR 触发", () => {
      expect(isAuthorizedSender("OWNER")).toBe(true);
      expect(isAuthorizedSender("MEMBER")).toBe(true);
      expect(isAuthorizedSender("COLLABORATOR")).toBe(true);
      expect(isAuthorizedSender("owner")).toBe(true);
    });

    it("必须拦截外部普通贡献者与匿名用户", () => {
      expect(isAuthorizedSender("CONTRIBUTOR")).toBe(false);
      expect(isAuthorizedSender("FIRST_TIME_CONTRIBUTOR")).toBe(false);
      expect(isAuthorizedSender("NONE")).toBe(false);
      expect(isAuthorizedSender(null)).toBe(false);
    });
  });

  describe("3. IssuePayload 结构化构建测试", () => {
    it("应能构建符合 @repoclaw/shared 规范的标准载荷", () => {
      const payload = buildIssuePayload({
        repoOwner: "facebook",
        repoName: "react",
        cloneUrl: "https://github.com/facebook/react.git",
        issueNumber: 42,
        issueTitle: "Sample bug",
        issueBody: "Traceback here",
        commentId: 1001,
        commentSender: "octocat",
        authorAssociation: "OWNER",
      });

      expect(payload.id).toBeDefined();
      expect(payload.repoFullName).toBe("facebook/react");
      expect(payload.issueNumber).toBe(42);
      expect(payload.authorAssociation).toBe("OWNER");
    });
  });
});
