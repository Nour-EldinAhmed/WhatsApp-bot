// ==========================================================
// طبقة ذكاء اصطناعي احتياطية (اختيارية) عبر OpenRouter
// - بتستخدم "openrouter/free" اللي بيختار أقوى موديل متاح مجانًا تلقائيًا
// - بتتفعّل بس لو العميل حط OPENROUTER_API_KEY في .env
// - بتشتغل فقط لما محرك القواعد العادي (matchEngine) يفشل يلاقي إجابة،
//   عشان نوفر من حد الطلبات المجاني (تقريبًا 20 طلب/دقيقة)
// ==========================================================

const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// بدل موديل عشوائي (كان أحيانًا بيختار موديل ضعيف جدًا وبيرد ردود ركيكة/مفككة)،
// بنجرب موديلات مجانية معروفة الجودة بالترتيب، وأول واحد يرد بيتستخدم.
// لو حد منهم اتشال من قايمة المجاني عند OpenRouter مستقبلاً، ينفع تحدّث القايمة من openrouter.ai/models
const FREE_MODELS = [
  'openai/gpt-oss-120b:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'openrouter/free', // خط دفاع أخير: الراوتر العشوائي لو كل حاجة تانية فشلت
];

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
3. رد قصير مناسب للواتساب (2-3 جمل بحد أقصى)، من غير مقدمات، ومن غير رموز ماركداون زي ** أو #.
4. اكتب بلغة عربية سليمة ومفهومة 100%. ممنوع أي كلام مبهم أو غير مترابط أو جمل ناقصة المعنى.
5. لو مش لاقي إجابة واضحة، اعتذر بجملة واحدة بسيطة وحوّل العميل للإدارة - متحاولش تخمن أو تأليف رد غامض.`;
  }

  async tryAnswer(userMessage, scheduleText) {
    if (!this.enabled) return null;

    for (const model of FREE_MODELS) {
      try {
        const res = await axios.post(
          OPENROUTER_URL,
          {
            model,
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
            timeout: 12000,
          }
        );
        const text = res.data?.choices?.[0]?.message?.content?.trim();
        // بعض الموديلات الضعيفة بترجع رد فاضي أو قصير جدًا مالوش معنى - نعتبره فشل ونجرب اللي بعده
        if (text && text.length >= 5) return text;
        console.warn(`[AI Fallback] رد غير مقبول من ${model}, بنجرب الموديل التالي`);
      } catch (err) {
        console.warn(`[AI Fallback] فشل الاتصال بـ ${model}:`, err.response?.data?.error?.message || err.message);
      }
    }
    return null; // كل الموديلات فشلت - هنرجع للرد الاحتياطي العادي (التواصل مع الإدارة)
  }
}

module.exports = AiFallback;
