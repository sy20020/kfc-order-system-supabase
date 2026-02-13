// ========== sykfc.top 紧急修复中间件（Vercel Edge）==========
export const config = {
  matcher: '/(.*)'  // 匹配所有路径，确保所有 HTML 响应都被注入
};

export default async function middleware(request) {
  const response = await fetch(request);
  const contentType = response.headers.get('content-type') || '';
  
  // 只处理 HTML 响应（不处理 JS、CSS、图片等）
  if (!contentType.includes('text/html')) {
    return response;
  }

  const html = await response.text();
  
  // ----- 修复脚本：解决白屏、数据加载失败、分享链接验证问题 -----
  const fixScript = `<script>
// ---------- Vercel 注入：零侵入修复 ----------
(function() {
  // 1. 覆写 validateShareLink：验证失败只弹提示，绝不隐藏页面
  window.validateShareLink = async function(shareCode) {
    if (shareCode?.includes("?")) shareCode = shareCode.split("?")[0];
    try {
      const link = await window.SupabaseData?.getShareLinkByCode(shareCode);
      if (!link?.active) { window.showNotification?.("分享链接无效", "warning"); return false; }
      if (link.expiresAt && Date.now() > link.expiresAt) { window.showNotification?.("链接已过期", "warning"); return false; }
      if (link.usedCount >= link.maxUses) { window.showNotification?.("使用次数已用完", "warning"); return false; }
      window.currentShareLink = link;
      window.currentShareCode = shareCode;
      document.body.classList.add("link-entered");
      const meal = window.meals?.find(m => m.id === link.mealId);
      if (meal?.active !== false) window.showMealDetail?.(link.mealId);
      return true;
    } catch(e) { console.warn("验证异常", e); return false; }
  };

  // 2. 彻底删除白屏函数（原函数会导致页面清空）
  window.hideAllPagesAndContent = function(){};

  // 3. 强制关闭卡死的 Loading 动画（5秒后自动消失）
  setTimeout(function() {
    const loading = document.getElementById("globalLoading");
    if (loading?.classList.contains("active")) {
      loading.classList.remove("active");
      document.body.style.overflow = "auto";
    }
  }, 5000);

  // 4. 自动重试数据加载（解决首次访问“暂无套餐”）
  if (window.meals?.length === 0) {
    setTimeout(() => {
      window.loadAllDataFromSupabase?.().then(() => {
        window.updateHomePage?.();
        window.updateMealList?.("all");
      });
    }, 1000);
  }
})();
</script>`;

  // 在 </body> 前注入修复脚本
  const modifiedHtml = html.replace('</body>', fixScript + '</body>');
  
  return new Response(modifiedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}