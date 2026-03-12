import { policyAgent } from './policyAgent';

async function main() {
  const policy = new policyAgent();

  const policyQuestion = 'What is my deductible?';
  const policyAnswer = await policy.answerQuery(policyQuestion);

  const cookieQuestion = 'Where is my cookie?';
  const cookieAnswer = await policy.answerQuery(cookieQuestion);

  console.log('Policy Question:', policyQuestion);
  console.log('Answer:', policyAnswer);

  console.log('Policy Question:', cookieQuestion);
  console.log('Answer:', cookieAnswer);
}

void main();

