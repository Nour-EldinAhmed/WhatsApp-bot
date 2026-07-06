// ==========================================================
// طبقة ذكاء اصطناعي احتياطية (اختيارية) عبر OpenRouter
// - بتستخدم "openrouter/free" اللي بيختار أقوى موديل متاح مجانًا تلقائيًا
// - بتتفعّل بس لو العميل حط OPENROUTER_API_KEY في .env
// - بتشتغل فقط لما محرك القواعد العادي (matchEngine) يفشل يلاقي إجابة،
//   عشان نوفر من حد الطلبات المجاني (تقريبًا 20 طلب/دقيقة)
// ==========================================================

const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const FREE_MODEL = 'openrouter/free'; // راوتر بيختار موديل مجاني متاح تلقائيًا

class AiFallback {
  constructor({ apiKey, businessName, adminName, adminPhone }) {
    this.apiKey = apiKey;
    this.enabled = Boolean(apiKey);
    this.businessName = businessName;
    this.adminName = adminName;
    this.adminPhone = adminPhone;
  }

  buildSystemPrompt(scheduleText) {
    return `أنت مساعد رد على عملاء "${this.businessName}" على واتساب باللهجة المصرية العامية، بأسلوب ودود ومختصر.

معاك جدول المواعيد ده بس، ومحتاج تجاوب استفسار العميل بناءً عليه فقط:
--- بداية الجدول ---
${scheduleText}
--- نهاية الجدول ---

تعليمات صارمة:
1. جاوب من الجدول اللي فوق بس. ممنوع تختلق أي معلومة مش موجودة فيه.
2. لو مش متأكد أو المعلومة مش موجودة، قول للعميل يتواصل مع "${this.adminName}" على الرقم ${this.adminPhone}.
3. رد قصير مناسب للواتساب، من غير مقدمات، ومن غير رموز ماركداون زي ** أو #.`;
  }

  async tryAnswer(userMessage, scheduleText) {
    if (!this.enabled) return null;
    try {
      const res = await axios.post(
        OPENROUTER_URL,
        {
          model: FREE_MODEL,
          messages: [
            { role: 'system', content: this.buildSystemPrompt(scheduleText) },
            { role: 'user', content: userMessage },
          ],
          max_tokens: 300,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      const text = res.data?.choices?.[0]?.message?.content?.trim();
      return text || null;
    } catch (err) {
      console.warn('[AI Fallback] فشل الاتصال بـ OpenRouter:', err.response?.data || err.message);
      return null; // لو فشل، هنرجع للرد الاحتياطي العادي (التواصل مع الإدارة)
    }
  }
}

module.exports = AiFallback;
