"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const updates = [
      {
        code: "AE",
        description:
          "TAX-FREE OPPORTUNITY — Global corporations seek qualified expats.",
        order: 1,
      },
      {
        code: "SA",
        description:
          "VISION 2030 ECONOMY — Engineers, project managers, and executives thrive.",
        order: 2,
      },
      {
        code: "US",
        description:
          "GLOBAL CAREER PEAK — High salaries and world-class employers need qualified professionals.",
        order: 3,
      },
      {
        code: "CA",
        description:
          "EASY IMMIGRATION PATH — Degrees and skills transfer easily with friendly visa systems.",
        order: 4,
      },
      {
        code: "GB",
        description:
          "GLOBAL RECOGNITION — Strong demand in IT, healthcare, and finance.",
        order: 5,
      },
      {
        code: "DE",
        description:
          "ENGINEERING POWERHOUSE — Technical and skilled labor valued with stable contracts.",
        order: 6,
      },
      {
        code: "FR",
        description:
          "CREATIVE & MANAGEMENT HUB — Ideal for design, business, and luxury sectors.",
        order: 7,
      },
      {
        code: "CH",
        description:
          "HIGH-INCOME MARKET — Suits experienced experts in finance, pharma, and law.",
        order: 8,
      },
      {
        code: "NL",
        description:
          "ENGLISH-FRIENDLY TECH BASE — Perfect for IT, logistics, and sustainability talent.",
        order: 9,
      },
      {
        code: "IE",
        description:
          "TECH HQ CENTER — Multinationals actively hire international graduates.",
        order: 10,
      },
      {
        code: "SE",
        description:
          "INNOVATION ECONOMY — Best for digital, green-tech, and design roles.",
        order: 11,
      },
      {
        code: "NO",
        description:
          "ENERGY & RESEARCH — Great for engineers and analysts seeking high standards.",
        order: 12,
      },
      {
        code: "AU",
        description:
          "SKILL-BASED IMMIGRATION — Recognizes global qualifications directly.",
        order: 13,
      },
      {
        code: "NZ",
        description:
          "WORK-LIFE BALANCE — Ideal for healthcare, IT, and education roles.",
        order: 14,
      },
      {
        code: "SG",
        description:
          "ASIA’S FINANCE HUB — High salaries and modern English-speaking environment.",
        order: 15,
      },
      {
        code: "JP",
        description:
          "TECHNOLOGY & EDUCATION — Welcomes tech, language, and research experts.",
        order: 16,
      },
      {
        code: "KR",
        description:
          "TECH-DRIVEN ECONOMY — Perfect for digital, media, and STEM skills.",
        order: 17,
      },
      {
        code: "QA",
        description:
          "INFRASTRUCTURE & EDUCATION — High-paying professional roles available.",
        order: 18,
      },
      {
        code: "KW",
        description:
          "HIGH-SALARY MARKET — Ideal for healthcare and engineering backgrounds.",
        order: 19,
      },
      {
        code: "OM",
        description:
          "STABLE EXPAT JOBS — Great for teaching, energy, and tourism fields.",
        order: 20,
      },
      {
        code: "IN",
        description:
          "GLOBAL TECH TALENT — Ideal for IT, marketing, and management careers.",
        order: 21,
      },
      {
        code: "PK",
        description:
          "DIGITAL FREELANCE HUB — Developers and marketers find remote success.",
        order: 22,
      },
      {
        code: "DK",
        description:
          "QUALITY OF LIFE & INNOVATION — Highly educated professionals thrive in sustainable energy, design, and tech sectors with strong English adoption and easy online payment culture.",
        order: 23,
      },
      {
        code: "MY",
        description:
          "BUSINESS & FINTECH CENTER — Great for bilingual professionals in IT and banking.",
        order: 24,
      },
      {
        code: "TH",
        description:
          "TOURISM & DIGITAL JOBS — Suits creatives and hospitality experts.",
        order: 25,
      },
      {
        code: "ID",
        description:
          "MANUFACTURING GROWTH — Engineers and business graduates in demand.",
        order: 26,
      },
      {
        code: "PH",
        description:
          "ENGLISH-SPEAKING WORKFORCE — Excellent for BPO and online careers.",
        order: 27,
      },
      {
        code: "CN",
        description:
          "GLOBAL INDUSTRIAL GIANT — Teachers, managers, and engineers sought worldwide.",
        order: 28,
      },
      {
        code: "HK",
        description:
          "INTERNATIONAL FINANCE CENTER — Great for trade and management experts.",
        order: 29,
      },
      {
        code: "TR",
        description:
          "CROSS-CONTINENTAL ECONOMY — Business and construction professionals excel.",
        order: 30,
      },
      {
        code: "ZA",
        description:
          "MULTI-SECTOR ECONOMY — Ideal for business, IT, and logistics.",
        order: 31,
      },
      {
        code: "NG",
        description:
          "TECH & BUSINESS EXPANSION — Suited for finance and digital innovators.",
        order: 32,
      },
      {
        code: "KE",
        description:
          "EAST AFRICA’S TECH GATEWAY — Start-ups hire globally-skilled talent.",
        order: 33,
      },
      {
        code: "BR",
        description:
          "LATIN AMERICAN LEADER — Creative and trade industries booming.",
        order: 34,
      },
      {
        code: "MX",
        description:
          "NEAR-US ADVANTAGE — Great for engineers, logistics, and sales.",
        order: 35,
      },
      {
        code: "CL",
        description:
          "BUSINESS-FRIENDLY ECONOMY — Finance and engineering roles expanding.",
        order: 36,
      },
      {
        code: "CO",
        description:
          "GROWING TECH HUB — Bilingual professionals in high demand.",
        order: 37,
      },
      {
        code: "AR",
        description:
          "EDUCATED WORKFORCE — Suited for IT, design, and remote jobs.",
        order: 38,
      },
      {
        code: "ES",
        description:
          "CREATIVE & TEACHING MARKET — Attractive for digital nomads and educators.",
        order: 39,
      },
      {
        code: "PT",
        description:
          "EASY RESIDENCY VISAS — Perfect for freelancers and remote tech roles.",
        order: 40,
      },
      {
        code: "IT",
        description:
          "DESIGN & CULINARY INDUSTRY — Great for creative professionals.",
        order: 41,
      },
      {
        code: "PL",
        description:
          "EUROPE’S IT ENGINE — Strong demand for developers and analysts.",
        order: 42,
      },
      {
        code: "RO",
        description:
          "TECH AND SUPPORT BASE — Excellent for remote and bilingual roles.",
        order: 43,
      },
      {
        code: "CZ",
        description:
          "STABLE ENGINEERING SECTOR — Ideal for industrial professionals.",
        order: 44,
      },
      {
        code: "HU",
        description:
          "COST-EFFECTIVE EUROPE — Suited for finance and IT specialists.",
        order: 45,
      },
      {
        code: "AT",
        description:
          "CENTRAL EUROPE ACCESS — Great for skilled engineers and managers.",
        order: 46,
      },
      {
        code: "BE",
        description:
          "EU ADMIN CENTER — Multilingual professionals find top roles.",
        order: 47,
      },
      // 48 DK duplicate ignored (first occurrence already used)
      {
        code: "FI",
        description:
          "INNOVATION FOCUSED — Ideal for tech and education professionals.",
        order: 49,
      },
      {
        code: "LU",
        description:
          "FINANCIAL PRESTIGE — Great for accounting and corporate law.",
        order: 50,
      },
      {
        code: "EE",
        description:
          "DIGITAL NATION — Excellent for programmers and entrepreneurs.",
        order: 51,
      },
      {
        code: "LT",
        description: "STARTUP HOTSPOT — Great for IT and creative roles.",
        order: 52,
      },
      {
        code: "IL",
        description:
          "STARTUP NATION — High-tech and innovation professionals thrive.",
        order: 53,
      },
      {
        code: "CY",
        description:
          "FINANCE & REMOTE FRIENDLY — Attractive for bilingual professionals.",
        order: 54,
      },
      {
        code: "BH",
        description:
          "BUSINESS-ORIENTED ECONOMY — Finance and trade experts valued.",
        order: 55,
      },
      // 56 QA duplicate ignored (first occurrence already used)
      // 57 OM duplicate ignored (first occurrence already used)
      {
        code: "VN",
        description:
          "ASIA’S NEXT TECH ZONE — Engineers and marketers in strong demand.",
        order: 58,
      },
      {
        code: "LK",
        description:
          "SERVICE AND EXPORT SECTOR — Suits business and hospitality graduates.",
        order: 59,
      },
      {
        code: "MT",
        description:
          "REMOTE WORK PARADISE — Ideal for IT and finance professionals.",
        order: 60,
      },
    ];

    for (const item of updates) {
      await queryInterface.bulkUpdate(
        "countries",
        {
          description: item.description,
          sort_order: item.order,
          updated_at: new Date(),
        },
        { country_code: item.code }
      );
    }
  },

  async down(queryInterface, Sequelize) {
    const codes = [
      "AE",
      "SA",
      "US",
      "CA",
      "GB",
      "DE",
      "FR",
      "CH",
      "NL",
      "IE",
      "SE",
      "NO",
      "AU",
      "NZ",
      "SG",
      "JP",
      "KR",
      "QA",
      "KW",
      "OM",
      "IN",
      "PK",
      "DK",
      "MY",
      "TH",
      "ID",
      "PH",
      "CN",
      "HK",
      "TR",
      "ZA",
      "NG",
      "KE",
      "BR",
      "MX",
      "CL",
      "CO",
      "AR",
      "ES",
      "PT",
      "IT",
      "PL",
      "RO",
      "CZ",
      "HU",
      "AT",
      "BE",
      "FI",
      "LU",
      "EE",
      "LT",
      "IL",
      "CY",
      "BH",
      "VN",
      "LK",
      "MT",
    ];

    for (const code of codes) {
      await queryInterface.bulkUpdate(
        "countries",
        { description: null, sort_order: null, updated_at: new Date() },
        { country_code: code }
      );
    }
  },
};
