//const { attest, sgx, types } = require('sgx-ias-js');

import { attest, sgx, types } from 'sgx-ias-js';
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
app.use(bodyParser.json());
const corsOptions ={
  origin:'http://localhost:9999', 
  credentials:true,            //access-control-allow-credentials:true
  optionSuccessStatus:200
}
app.use(cors(corsOptions));


app.post('/verify', (req: Request, res: Response) => {
    const {IAS_REPORT, IAS_SIG_HEX, CODEEXP, NONCE} = req.body;
    console.log(IAS_SIG_HEX, CODEEXP, NONCE);

    const EVIDENCE = {
        report: IAS_REPORT,
        signature: types.parseHex(IAS_SIG_HEX.trim().replace("\n", "")),
    }; 


    const verifier = (): attest.AttestationVerifier => attest.AttestationVerifier.from(EVIDENCE);
    let mr_expected = sgx.parse_measurement(CODEEXP);
    
    let nonce_expected = NONCE;
    let answer = JSON.stringify({workingEnv: verifier().nonce(nonce_expected).verify().verdict === attest.AttestationVerdict.Ok, codeValidated: verifier().mr_enclave(mr_expected).verify().verdict === attest.AttestationVerdict.Ok});

    res.send(answer)
});


app.listen(3000, () => {
  console.log('Server started on port 3000');
});