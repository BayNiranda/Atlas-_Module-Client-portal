// Standard Service Agreement wording (Lao + English), from the general clauses of
// Atlas's existing engagement letter, with client details replaced by fields.
// Lao text is kept exactly as Atlas wrote it. OWNER MUST APPROVE before real use.
//
// Fields filled in when an agreement is prepared:
//   {{start}} {{end}}   engagement period (e.g. "01 June 2026")
//   {{proposal}}        accepted proposal reference (e.g. "PRO-2611-0005 v1")
// Articles 1, 3 and 4 are generated from the client and the accepted proposal.

export type Clause = { lo: string; en: string };
export type Article = { no: number; title: Clause; intro?: Clause; items?: Clause[]; paragraphs?: Clause[] };

export const TEMPLATE_VERSION = 1;

export const DOCUMENT_TITLE: Clause = { lo: "ໜັງສືສັນຍາການໃຫ້ບໍລິການ", en: "Service Agreement" };

export const DEFINITIONS: Article = {
  no: 2,
  title: { lo: "ຄຳນິຍາມ", en: "Definitions" },
  intro: { lo: "ໃນສັນຍານີ້, ຄຳສັບຕໍ່ໄປນີ້ຈະມີຄວາມໝາຍດັ່ງລຸ່ມນີ້:", en: "In this Agreement, the following terms shall have the meanings set out below:" },
  items: [
    { lo: "\"ສັນຍາ\" ໝາຍເຖິງໜັງສືສັນຍາແລະຕາຕະລາງທັງໝົດຂອງສັນຍາສະບັບນີ້.", en: "\"Agreement\" means this Engagement Letter and Service Agreement, including all Schedules." },
    { lo: "“ວຽກນຳສົ່ງ” ໝາຍເຖິງ ບົດລາຍງານ, ເອກະສານລາຍງານການເງິນ, ນະໂຍບາຍ, ໂຄງຮ່າງການບໍລິຫານ ແລະ ເອກະສານທັງໝົດ ທີ່ ບໍລິສັດ ແອັດລາສ ແອດໄວເຊີຣີ ຈຳກັດ ໄດ້ຈັດກະກຽມພາຍໃຕ້ສັນຍາສະບັບນີ້.\"", en: "\"Deliverables\" means all reports, financial statements, policies, frameworks, and documentation produced by Atlas under this Agreement." },
    { lo: "\"ໄລຍະດຳເນີນງານ\" ໝາຍເຖິງ {{start}} ຫາ {{end}}.", en: "\"Engagement Period\" means {{start}} to {{end}}." },
    { lo: "\"ຄ່າທຳນຽມ\" ໝາຍເຖິງຄ່າທຳນຽມຄົງທີ່ທີ່ກຳນົດໃນມາດຕາ 4.", en: "\"Fees\" means the fixed fees set out in Article 4." },
    { lo: "“ຂໍ້ມູນລັບ” ໝາຍເຖິງ ຂໍ້ມູນທັງໝົດທີ່ບໍ່ໄດ້ເປີດເຜີຍຕໍ່ສາທາລະນະຊົນ ເຊິ່ງກ່ຽວຂ້ອງກັບຄູ່ສັນຍາຝ່າຍໃດຝ່າຍໜຶ່ງ ທີ່ໄດ້ຖືກເປີດເຜີຍ ເພື່ອຈຸດປະສົງທີ່ກ່ຽວຂ້ອງກັບສັນຍາສະບັບນີ້.\"", en: "\"Confidential Information\" means all non-public information relating to either party disclosed in connection with this Agreement." },
  ],
};

export const SCOPE_INTRO: Clause = {
  lo: "ບໍລິສັດ ແອັດລາສ ແອດໄວເຊີຣີ ຈະໃຫ້ບໍລິການດັ່ງຕໍ່ໄປນີ້ໃນໄລຍະດຳເນີນງານ:",
  en: "Atlas Advisory shall provide the following advisory services during the Engagement Period:",
};

export const PAYMENT_GENERAL: Clause = {
  lo: "ການຊຳລະດຳເນີນໂດຍການໂອນທະນາຄານຕາມຂໍ້ມູນທີ່ອາຕລາດສົ່ງໃຫ້. ຖ້າການຊຳລະລ່າຊ້າກວ່າ 7 ວັນຫຼັງຄົບກຳນົດ, ອາຕລາດມີສິດຢຸດວຽກຊົ່ວຄາວຈົນກວ່າຈະໄດ້ຮັບການຊຳລະ. ຄ່າທຳນຽມທັງໝົດບໍ່ລວມອາກອນທີ່ໃຊ້ສຳລັບ.",
  en: "Payment shall be made by bank transfer to account details provided by Atlas. If payment is not received within seven (7) calendar days of the due date, Atlas reserves the right to suspend work until payment is received. All fees are stated exclusive of applicable taxes.",
};

export const PARTS: { no: number; title: Clause; articles: number[] }[] = [
  { no: 1, title: { lo: "ຄູ່ສັນຍາແລະຄຳນິຍາມ", en: "Parties and Definitions" }, articles: [1, 2] },
  { no: 2, title: { lo: "ຂອບເຂດການໃຫ້ບໍລິການ", en: "Scope of Services" }, articles: [3] },
  { no: 3, title: { lo: "ຄ່າທຳນຽມແລະການຊຳລະ", en: "Fees and Payment" }, articles: [4] },
  { no: 4, title: { lo: "ພັນທະຂອງຄູ່ສັນຍາ", en: "Obligations of the Parties" }, articles: [5, 6] },
  { no: 5, title: { lo: "ຄວາມລັບແລະການຮັບຮອງ", en: "Confidentiality and Representations" }, articles: [7, 8] },
  { no: 6, title: { lo: "ໄລຍະເວລາແລະການສິ້ນສຸດ", en: "Term and Termination" }, articles: [9, 10] },
  { no: 7, title: { lo: "ຂໍ້ກຳນົດທົ່ວໄປ", en: "General Provisions" }, articles: [11, 12, 13, 14, 15, 16] },
];

export const ARTICLE_TITLES: Record<number, Clause> = {
  1: { lo: "ຄູ່ສັນຍາ", en: "Parties" },
  3: { lo: "ຂອບເຂດການໃຫ້ບໍລິການ", en: "Scope of Services" },
  4: { lo: "ຄ່າທຳນຽມແລະກຳນົດການຊຳລະ", en: "Fees and Payment Schedule" },
};

// Articles 5 to 16, as written in Atlas's existing agreement (general wording).
export const STANDARD_ARTICLES: Article[] = [
  {
    no: 5, title: { lo: "ພັນທະຂອງອາຕລາດ", en: "Obligations of Atlas" },
    intro: { lo: "ອາຕລາດຈະ:", en: "Atlas shall:" },
    items: [
      { lo: "ດຳເນີນການໃຫ້ບໍລິການດ້ວຍຄວາມຊຳນານ, ຄວາມໃສ່ໃຈແລະຄວາມພາກພຽນສອດຄ່ອງກັບມາດຕະຖານວິຊາຊີບ.", en: "Perform the Services with reasonable skill, care, and diligence in accordance with applicable professional standards." },
      { lo: "ຈັດສົ່ງບຸກຄະລາກອນທີ່ມີຄຸນວຸດທິເໝາະສົມຕລອດໄລຍະດຳເນີນງານ.", en: "Assign suitably qualified personnel to the engagement throughout the Engagement Period." },
      { lo: "ແຈ້ງລູກຄ້າກ່ຽວກັບຄວາມຄືບໜ້າທີ່ສຳຄັນແລະບັນຫາໃດທີ່ອາດກະທົບການສົ່ງມອບ.", en: "Keep the Client informed of material progress and any issues that may affect delivery." },
      { lo: "ຮັກສາຄວາມລັບຂອງຂໍ້ມູນລັບທັງໝົດທີ່ໄດ້ຮັບຈາກລູກຄ້າ.", en: "Maintain the confidentiality of all Confidential Information received from the Client." },
      { lo: "ປະຕິບັດຕາມກົດໝາຍແລະລະບຽບທີ່ໃຊ້ໄດ້ຂອງສ.ປ.ປ.ລາວໃນການໃຫ້ບໍລິການ.", en: "Comply with applicable laws and regulations of Lao PDR in performing the Services." },
    ],
  },
  {
    no: 6, title: { lo: "ພັນທະຂອງລູກຄ້າ", en: "Obligations of the Client" },
    intro: { lo: "ລູກຄ້າຈະ:", en: "The Client shall:" },
    items: [
      { lo: "ສະໜອງໃຫ້ອາຕລາດເຂົ້າເຖິງຂໍ້ມູນ, ບັນທຶກ, ບຸກຄະລາກອນແລະລະບົບທັງໝົດທີ່ຈຳເປັນໂດຍທັນທີ.", en: "Provide Atlas with timely access to all information, records, personnel, and systems reasonably required to perform the Services." },
      { lo: "ກຳນົດຜູ້ຕິດຕໍ່ຫຼັກທີ່ມີສິດໃຫ້ຄຳສັ່ງ, ອະນຸມັດຜົນງານແລະຕັດສິນໃຈໃນນາມລູກຄ້າ.", en: "Designate a primary contact person with authority to give instructions, approve deliverables, and make decisions on behalf of the Client." },
      { lo: "ຕອບສະໜອງຄຳຮ້ອງຂໍຂໍ້ມູນຫຼືການອະນຸມັດຂອງອາຕລາດພາຍໃນ 5 ວັນເຮັດວຽກ.", en: "Respond to Atlas's requests for information or approval within five (5) Business Days." },
      { lo: "ແຈ້ງອາຕລາດທັນທີເມື່ອມີການປ່ຽນແປງທີ່ສຳຄັນຕໍ່ທຸລະກິດ, ຄວາມເປັນເຈົ້າຂອງຫຼືສະຖານະການເງິນ.", en: "Notify Atlas promptly of any material change to the Client's business, ownership, or financial position that may affect the Services." },
      { lo: "ຊຳລະຄ່າທຳນຽມທັງໝົດຕາມມາດຕາ 4.", en: "Pay all Fees in accordance with Article 4." },
    ],
  },
  {
    no: 7, title: { lo: "ຄວາມລັບ", en: "Confidentiality" },
    paragraphs: [{
      lo: "ທັງສອງຝ່າຍຈະ: (ກ) ຮັກສາຂໍ້ມູນລັບຢ່າງເຄັ່ງຄັດ; (ຂ) ບໍ່ເປີດເຜີຍຕໍ່ບຸກຄົນທີສາມໂດຍບໍ່ໄດ້ຮັບຄວາມຍິນຍອມເປັນລາຍລັກອັກສອນ; ແລະ (ຄ) ໃຊ້ສະເພາະເພື່ອຈຸດປະສົງຂອງສັນຍານີ້ເທົ່ານັ້ນ. ພັນທະນີ້ຈະຍັງຄົງມີຜົນ 3 ປີຫຼັງສິ້ນສຸດສັນຍາ.",
      en: "Each party undertakes to: (a) hold all Confidential Information in strict confidence; (b) not disclose to any third party without prior written consent; and (c) use solely for the purposes of this Agreement. This obligation survives termination for three (3) years.",
    }],
  },
  {
    no: 8, title: { lo: "ການຮັບຮອງແລະການຮັບປະກັນ", en: "Representations and Warranties" },
    paragraphs: [{
      lo: "ຝ່າຍໃດໜຶ່ງຮັບຮອງແລະຮັບປະກັນວ່າ: (ກ) ມີອຳນາດເຕັມທີ່ໃນການລົງນາມສັນຍາ; (ຂ) ສັນຍານີ້ເປັນພັນທະທີ່ຖືກຕ້ອງແລະສາມາດບັງຄັບໄດ້; ແລະ (ຄ) ການລົງນາມບໍ່ຂັດຕໍ່ກົດໝາຍຫຼືສັນຍາໃດໆທີ່ຕົນຜູກພັນ.",
      en: "Each party represents and warrants that: (a) it has full power and authority to enter into and perform this Agreement; (b) this Agreement constitutes a valid and binding obligation; and (c) execution does not violate any applicable law or other agreement by which it is bound.",
    }],
  },
  {
    no: 9, title: { lo: "ໄລຍະເວລາ", en: "Term" },
    paragraphs: [{
      lo: "ສັນຍານີ້ເລີ່ມວັນທີ {{start}} ແລະດຳເນີນຕໍ່ຈົນວັນທີ {{end}} (\"ໄລຍະດຳເນີນງານ\") ເວ້ນແຕ່ຈະຖືກຍຸຕິກ່ອນຕາມມາດຕາ 10.",
      en: "This Agreement shall commence on {{start}} and continue until {{end}} (the \"Engagement Period\"), unless earlier terminated in accordance with Article 10.",
    }],
  },
  {
    no: 10, title: { lo: "ການຍຸຕິ", en: "Termination" },
    paragraphs: [
      { lo: "ຝ່າຍໃດໜຶ່ງສາມາດຍຸຕິສັນຍານີ້ໂດຍແຈ້ງເປັນລາຍລັກອັກສອນ 30 ວັນກ່ອນ.", en: "Either party may terminate this Agreement by giving thirty (30) calendar days' written notice to the other party." },
      { lo: "ຝ່າຍໃດໜຶ່ງສາມາດຍຸຕິທັນທີດ້ວຍການແຈ້ງເປັນລາຍລັກອັກສອນຖ້າ: (ກ) ອີກຝ່າຍລະເມີດສັນຍາຢ່າງຮ້າຍແຮງໂດຍບໍ່ໄດ້ແກ້ໄຂພາຍໃນ 14 ວັນ; ຫຼື (ຂ) ອີກຝ່າຍລ້ົມລະລາຍຫຼືຢຸດດຳເນີນທຸລະກິດ.", en: "Either party may terminate immediately by written notice if the other party: (a) commits a material breach not remedied within fourteen (14) days of written notice; or (b) becomes insolvent or ceases to carry on business." },
      { lo: "ເມື່ອຍຸຕິ, ລູກຄ້າຊຳລະສຳລັບການໃຫ້ບໍລິການແລະລາຍຈ່າຍທີ່ສົມເຫດສົມຜົນຈົນເຖິງວັນຍຸຕິ. ຖ້າລູກຄ້າຍຸຕິໂດຍບໍ່ມີເຫດຜົນ, ຄ່າຈ້າງລ່ວງໜ້າຈະບໍ່ຖືກຄືນ.", en: "Upon termination, the Client shall pay Atlas for all Services rendered and expenses reasonably incurred to the effective date. If the Client terminates without cause, the retainer payment is non-refundable." },
    ],
  },
  {
    no: 11, title: { lo: "ການຈຳກັດຄວາມຮັບຜິດຊອບ", en: "Limitation of Liability" },
    paragraphs: [{
      lo: "ຄວາມຮັບຜິດຊອບລວມຂອງອາຕລາດພາຍໃຕ້ສັນຍານີ້ຈະບໍ່ເກີນຄ່າທຳນຽມທັງໝົດທີ່ລູກຄ້າໄດ້ຊຳລະໃນ 12 ເດືອນກ່ອນເກີດຮ້ອງຮຽນ. ອາຕລາດຈະບໍ່ຮັບຜິດຊອບຕໍ່ຄວາມສູນເສຍທາງທາງອ້ອມ, ກຳໄລຫຼືໂອກາດທາງທຸລະກິດ.",
      en: "Atlas's aggregate liability shall not exceed the total Fees paid by the Client in the twelve (12) months preceding the claim. Atlas shall not be liable for indirect, consequential, or special loss, loss of profit, or loss of business opportunity. Atlas is not liable for inaccuracies arising from incomplete or incorrect information supplied by the Client.",
    }],
  },
  {
    no: 12, title: { lo: "ຄວາມເປັນເອກະລາດ", en: "Independent Contractor" },
    paragraphs: [{
      lo: "ອາຕລາດຖືກຈ້າງໃນຖານະຜູ້ຮັບເໝົາອິດສະລະ. ສິ່ງໃດໃນສັນຍານີ້ຈະບໍ່ສ້າງຄວາມເປັນໄດ, ກິດຈະການຮ່ວມ, ອຳນາດຕົວແທນຫຼືຄວາມສຳພັນຈ້າງງານລະຫວ່າງຄູ່ສັນຍາ.",
      en: "Atlas is engaged as an independent contractor. Nothing in this Agreement creates a partnership, joint venture, agency, employment, or fiduciary relationship between the parties. Atlas retains the right to provide services to other clients during the Engagement Period, provided this does not create a material conflict of interest.",
    }],
  },
  {
    no: 13, title: { lo: "ຊັບສິນທາງປັນຍາ", en: "Intellectual Property" },
    paragraphs: [{
      lo: "ເມື່ອໄດ້ຮັບການຊຳລະຄົບຖ້ວນ, ສິດທິໃນຜົນງານທັງໝົດທີ່ອາຕລາດຜະລິດສະເພາະສຳລັບລູກຄ້າຈະໂອນໃຫ້ລູກຄ້າ. ອາຕລາດຮັກສາສິດທິທັງໝົດໃນວິທີການ, ຄວາມຊ່ຽວຊານແລະເຄື່ອງມືທີ່ມີຢູ່ກ່ອນ.",
      en: "Upon receipt of full payment, all Deliverables produced specifically for the Client shall vest in the Client. Atlas retains all rights in its pre-existing methodologies, know-how, and tools. Atlas may reference the engagement for marketing purposes (without disclosing Confidential Information) unless the Client objects in writing.",
    }],
  },
  {
    no: 14, title: { lo: "ກົດໝາຍທີ່ໃຊ້ແລະການແກ້ໄຂຂໍ້ຂັດແຍ່ງ", en: "Governing Law and Dispute Resolution" },
    paragraphs: [{
      lo: "ສັນຍານີ້ຢູ່ພາຍໃຕ້ກົດໝາຍສ.ປ.ປ.ລາວ. ໃນກໍລະນີທີ່ມີຂໍ້ຂັດແຍ່ງ, ທັງສອງຝ່າຍຈະພະຍາຍາມແກ້ໄຂດ້ວຍການເຈລະຈາ. ຖ້າບໍ່ສຳເລັດພາຍໃນ 30 ວັນຫຼັງໄດ້ຮັບໜັງສືແຈ້ງ, ຝ່າຍໃດກໍສາມາດຍື່ນຕໍ່ສານທີ່ມີຄວາມສາມາດໃນວຽງຈັນ.",
      en: "This Agreement is governed by the laws of Lao PDR. In the event of any dispute, the parties shall first attempt to resolve the matter through good-faith negotiation. If unresolved within thirty (30) days of written notice, either party may submit the matter to the courts of Lao PDR with competent jurisdiction in Vientiane.",
    }],
  },
  {
    no: 15, title: { lo: "ພາສາ", en: "Language" },
    paragraphs: [{
      lo: "ສັນຍານີ້ສ້າງຂຶ້ນໃນສອງພາສາຄືພາສາລາວແລະພາສາອັງກິດ. ໃນກໍລະນີທີ່ມີຄວາມຂັດແຍ້ງລະຫວ່າງສອງສະບັບ, ສະບັບພາສາລາວຈະເປັນຫຼັກ.",
      en: "This Agreement is made in both Lao and English. In the event of any inconsistency between the Lao and English texts, the Lao text shall prevail.",
    }],
  },
  {
    no: 16, title: { lo: "ສັນຍາທັງໝົດ", en: "Entire Agreement" },
    paragraphs: [{
      // Generalised: the original named one specific quotation; this refers to the accepted proposal.
      lo: "ສັນຍານີ້ທົດແທນຂໍ້ຕົກລົງທີ່ຜ່ານມາທັງໝົດລວມທັງຂໍ້ສະເໜີ {{proposal}}. ການແກ້ໄຂໃດໆຕ້ອງເປັນລາຍລັກອັກສອນແລະໄດ້ຮັບການລາຍເຊັນຈາກທັງສອງຝ່າຍ.",
      en: "This Agreement, together with any Schedules, supersedes all prior discussions, representations, and agreements, including Proposal {{proposal}}, the terms of which are incorporated herein. Any amendment must be in writing and signed by both parties.",
    }],
  },
];

export const SIGNATURE_INTRO: Clause = {
  lo: "ທັງສອງຝ່າຍໄດ້ຢືນຢັນການຕົກລົງໂດຍລາຍເຊັນຂ້າງລຸ່ມ, ນັບແຕ່ວັນທີ່ລະບຸຢູ່ໃນໜ້າທຳອິດຂອງສັນຍານີ້.",
  en: "IN WITNESS WHEREOF, the parties have executed this Agreement as of the date first written above.",
};

export const PROVIDER = {
  name: { lo: "ບໍລິສັດ ແອັດລາສ ແອດໄວເຊີຣີ ຈຳກັດ", en: "Atlas Advisory Co., Ltd." },
  address: { lo: "ນະຄອນຫຼວງວຽງຈັນ, ສປປ ລາວ", en: "Vientiane, Lao PDR" },
};

// Replace {{fields}} in a clause. Unknown fields are left visible so they get noticed.
export function fill(text: string, fields: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => fields[k] ?? m);
}
