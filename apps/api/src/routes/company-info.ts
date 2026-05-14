// Static YGE company facts — surfaced as JSON so any client (web,
// mobile, future portals) can render letterheads / signatures without
// hardcoding values.

import { Router } from 'express';

export const companyInfoRouter = Router();

companyInfoRouter.get('/', (_req, res) => {
  res.json({
    legalName: 'Young General Engineering, Inc.',
    address: {
      line1: '19645 Little Woods Rd',
      city: 'Cottonwood',
      state: 'CA',
      zip: '96022',
    },
    president: {
      name: 'Brook L. Young',
      phone: '707-499-7065',
      email: 'brookyoung@youngge.com',
    },
    vicePresident: {
      name: 'Ryan D. Young',
      phone: '707-599-9921',
      email: 'ryoung@youngge.com',
    },
    cslb: '1145219',
    dir: '2000018967',
    dot: '4528204',
    naics: '115310',
    pscCodes: ['F003', 'F004'],
    website: 'youngge.com',
    appHost: 'app.youngge.com',
  });
});
