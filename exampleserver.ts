import { attest, sgx, types } from 'sgx-ias-js';
import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
app.use(bodyParser.json());

app.use(bodyParser.json());
const corsOptions ={
  origin:'http://localhost:3000', 
  credentials:true,            //access-control-allow-credentials:true
  optionSuccessStatus:200
}
app.use(cors(corsOptions));

const fromSGX = {
  "IAS_REPORT": "{\"nonce\":\"some nonce\",\"id\":\"31209355433493617787376776503240433872\",\"timestamp\":\"2020-10-06T08:52:53.347575\",\"version\":4,\"epidPseudonym\":\"Itmg0J96ogakfocRkBJTgQpKMR\/vxHuzGzjBc4e7MOLi5YFG7MpdPvxc4ig9Kwr5JSCzB\/LFoRC35Pns2g+hqHHSO67EJ7kJw8FBUSnYYWxOrJn\/RnKPO\/V9NyLL04KOYnFZG6WJR8ocK\/TmHv9IhX0VvBHuOzuwlHV6eJk075Y=\",\"advisoryURL\":\"https:\/\/security-center.intel.com\",\"advisoryIDs\":[\"INTEL-SA-00161\",\"INTEL-SA-00320\",\"INTEL-SA-00329\",\"INTEL-SA-00220\",\"INTEL-SA-00270\",\"INTEL-SA-00293\",\"INTEL-SA-00233\"],\"isvEnclaveQuoteStatus\":\"GROUP_OUT_OF_DATE\",\"platformInfoBlob\":\"1502006504000900000F0F02040101070000000000000000000B00000B000000020000000000000B398400622A16A0D18310FE44F83C3759D80D9A509ADF3A9E3DF8912C35236289A76C9A02E31CBF7EC9BBE866A4C2B14976AF5F1F2F67432A910CAC8F9F1B2E443D\",\"isvEnclaveQuoteBody\":\"AgABADkLAAALAAoAAAAAAGVa+jP6pbnMXp4kH6IpuZQAAAAAAAAAAAAAAAAAAAAACBD\/\/wECAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAfAAAAAAAAAIn9CW9E4gK8MNf1FfUWauX3xTcHygIXbNBzU+wynQBOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABXexgNvNrje9nyZEQYnjunithb0DUVvyb1xEVcUoSyFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACoAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABjhc64dNI6h8\/p+VxDIHTPKpGbcBcVdFaW\/ntInWb2KW3oezUl5+GYyfwk1q80UOE8TjaarYTesWc\/aUoWB1Ul\"}",
  "IAS_SIG_HEX": "31fb8c591d9d4d4f71611c9f829a889be5c19857da86036181de37f966ea26838f57bfb197da250d609443956b93771dbf1f29921c83698eb4c593ba\r\ne26f4a428e3fe62811ec83b0fb1e3626103487f961630961842aed567d9a\r\n3b6778b8e2bd03d889b97d6b985a65058bbebd63022c4bb162ad045bfd55\r\nb86fb6fc9c4e19cfaff6c5503b6e1a49c58da10ad2fea7b2332c94129b5c\r\n01495b021bf7af1db7c504d1ae4f26b4894aa45104734ac9eb16cd438b80\r\ncb24c0b0757dbb05ebccfe8d2d72c223564c0a66227fe4c07a58dac93272\r\n2d81969f95d424b372b64ead2d697388dfa0da21fe5f99ec13171bd12f2c\r\n40e238ae25805879bd11f0c4267d3b5a",
  "CODEEXP": "89fd096f44e202bc30d7f515f5166ae5f7c53707ca02176cd07353ec329d004e",
  "NONCE": "some nonce"
  }

app.get('/', (req: Request, res: Response) => {
    res.send('<!DOCTYPE html><head><title>Super secure site</title></head><body>Hi!</body></html>')
});

app.post('/.well-known/attestation', (req: Request, res: Response) => {
  const {NONCE} = req.body;
  res.send(JSON.stringify(fromSGX));
});


app.listen(9999, () => {
  console.log('Server started on port 9999');
});