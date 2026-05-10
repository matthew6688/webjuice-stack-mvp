import fs from 'fs';
import path from 'path';

export interface TemplateFamily {
  id: string;
  niche: string;
  family: string;
  displayName: string;
  status: string;
  approvalState: 'draft' | 'qa-ready' | 'approved' | 'published';
  approved: boolean;
  subNiches: string[];
  bestFor: string[];
  notFor: string[];
  priceTiers: string[];
  notes: string[];
  href: string;
  adminHref: string;
  accent: string;
  image: string;
  qaScore: number | null;
  screenshots: string[];
  publicScreenshots: string[];
  runIds: string[];
  conceptDir: string;
  visualIssues: string[];
  nextAction: string;
  designContractPath: string;
  designSignalsPath: string;
  copyAuditScore: number | null;
  imageExperimentCount: number;
  brandKitPath: string;
  brandKitStatus: string;
  logoPolicy: string;
  logoOptionCount: number;
}

const ROOT = process.cwd();

const accentByFamily: Record<string, string> = {
  'classic-premium-roftix': '#0c3767',
  'editorial-bold-commercial': '#f15a24',
  'productized-modern-roofing': '#111827',
  'lead-capture-restoration': '#0f7a4f',
};

const fallbackImageByFamily: Record<string, string> = {
  'classic-premium-roftix': '/brand/images/section-01-hero.png',
  'editorial-bold-commercial': '/brand/images/section-03-taste-strategy.png',
  'productized-modern-roofing': '/brand/images/section-06-performance-seo.png',
  'lead-capture-restoration': '/brand/images/section-08-final-cta.png',
};

export function getTemplateFamilies(): TemplateFamily[] {
  const templatesDir = path.join(ROOT, 'templates');
  if (!fs.existsSync(templatesDir)) return [];

  const families: TemplateFamily[] = [];
  for (const niche of fs.readdirSync(templatesDir).sort()) {
    const familyRoot = path.join(templatesDir, niche, 'families');
    if (!fs.existsSync(familyRoot)) continue;
    for (const family of fs.readdirSync(familyRoot).sort()) {
      const manifestPath = path.join(familyRoot, family, 'template-manifest.json');
      if (!fs.existsSync(manifestPath)) continue;
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const approved = Boolean(manifest.qa?.approved);
      const status = manifest.status || 'draft';
      const approvalState = getApprovalState(status, approved);
      const screenshots = manifest.qa?.screenshotPaths || [];
      const publicScreenshots = getPublicScreenshots(niche, family, screenshots);
      families.push({
        id: manifest.templateId || `${niche}/${family}`,
        niche,
        family,
        displayName: manifest.displayName || titleize(family),
        status,
        approvalState,
        approved,
        subNiches: manifest.fit?.subNiches || [],
        bestFor: manifest.fit?.bestFor || [],
        notFor: manifest.fit?.notFor || [],
        priceTiers: manifest.fit?.priceTiers || [],
        notes: manifest.sourceInputs?.notes || [],
        href: `/templates/${niche}/${family}`,
        adminHref: `/admin/templates#${niche}-${family}`,
        accent: accentByFamily[family] || '#ff5a3d',
        image: getTemplatePreviewImage(niche, family),
        qaScore: typeof manifest.qa?.score === 'number' ? manifest.qa.score : null,
        screenshots,
        publicScreenshots,
        runIds: manifest.openDesign?.runIds || [],
        conceptDir: manifest.openDesign?.conceptDir || '',
        visualIssues: getVisualIssues(manifest, screenshots),
        nextAction: getNextAction(status, approved),
        designContractPath: manifest.designContract?.path || '',
        designSignalsPath: manifest.designSignals?.path || '',
        copyAuditScore: typeof manifest.copyAudit?.score === 'number' ? manifest.copyAudit.score : null,
        imageExperimentCount: Array.isArray(manifest.imageExperiments) ? manifest.imageExperiments.length : 0,
        brandKitPath: manifest.brandKit?.path || '',
        brandKitStatus: manifest.brandKit?.status || '',
        logoPolicy: manifest.brandKit?.logoPolicy || '',
        logoOptionCount: Number(manifest.brandKit?.logoOptionCount || 0),
      });
    }
  }
  return families;
}

export function getPublishedTemplateFamilies(): TemplateFamily[] {
  return getTemplateFamilies().filter((family) => family.approvalState === 'published');
}

function getTemplatePreviewImage(niche: string, family: string): string {
  const previewPath = path.join(ROOT, 'public', 'template-library', niche, family, 'desktop-index.png');
  if (fs.existsSync(previewPath)) {
    return `/template-library/${niche}/${family}/desktop-index.png`;
  }

  return fallbackImageByFamily[family] || '/brand/images/section-04-preview-gallery.png';
}

function getPublicScreenshots(niche: string, family: string, screenshots: string[]): string[] {
  return screenshots
    .map((screenshot) => path.basename(screenshot))
    .filter(Boolean)
    .filter((name) => fs.existsSync(path.join(ROOT, 'public', 'template-library', niche, family, name)))
    .map((name) => `/template-library/${niche}/${family}/${name}`);
}

function getApprovalState(status: string, approved: boolean): TemplateFamily['approvalState'] {
  if (status === 'published' && approved) return 'published';
  if (approved) return 'approved';
  if (status === 'qa-ready') return 'qa-ready';
  return 'draft';
}

function getNextAction(status: string, approved: boolean): string {
  if (status === 'published' && approved) return '已公开；后续只做版本更新';
  if (approved) return '可发布到官网模板库';
  if (status === 'qa-ready') return '需要人工视觉审批：图片、配色、参考还原度';
  return '继续生成或补齐 QA';
}

function getVisualIssues(manifest: any, screenshots: string[]): string[] {
  const issues: string[] = [];
  if (!screenshots.length) issues.push('缺少可审查截图');
  if (!manifest.qa?.approved) issues.push('尚未人工审批，不能进入官网模板库');
  if (manifest.visualAssetPlan?.forbidden?.some((item: string) => item.toLowerCase().includes('svg-only'))) {
    issues.push('仍需确认主视觉是否只是 SVG/示意图，参考图要求更高图片完成度');
  }
  if (!manifest.sourceInputs?.screenshots?.length) {
    issues.push('manifest 没有绑定原始参考截图，难以量化还原度');
  }
  if (!manifest.designSignals?.path) {
    issues.push('还没有从参考截图/链接抽取 design signals');
  }
  if (!manifest.designContract?.path) {
    issues.push('还没有生成 DESIGN.md 设计合同');
  }
  if (!manifest.imageExperiments?.length) {
    issues.push('还没有图片候选实验记录');
  }
  if (!manifest.brandKit?.path) {
    issues.push('还没有 brand-kit / 默认 logo 策略');
  } else if (Number(manifest.brandKit?.logoOptionCount || 0) !== 1) {
    issues.push('缺 logo 时必须只保留 1 个默认 demo logo 方案');
  }
  return issues;
}

function titleize(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}
