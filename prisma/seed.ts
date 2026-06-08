import 'dotenv/config'
import { PrismaClient } from '../src/generated/prisma/client'
import { PrismaNeon } from '@prisma/adapter-neon'
import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import AdmZip from 'adm-zip'

// ========== CONFIG ==========
const GENERATED_PATH = path.resolve(process.cwd(), 'prisma', 'generated_data.json')
const API_KEY = process.env.DEEPSEEK_API_KEY
const BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
const API_TIMEOUT = 60_000
const BATCH_SIZE = 20
const MAX_WORDS = 2000

const ECDICT_ZIP_URL = 'https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip'
const ECDICT_DIR = path.resolve(process.cwd(), 'prisma', 'ecdict')
const ECDICT_ZIP_PATH = path.join(ECDICT_DIR, 'ecdict.zip')
const ECDICT_DB_PATH = path.join(ECDICT_DIR, 'stardict.db')

// ========== INTERFACES ==========
interface VocabEntry {
  word: string
  phonetic?: string
  partOfSpeech: string
  definition: string
  example?: string
  exampleZh?: string
  collocations?: string
}

interface DeepSeekWord {
  word: string
  phonetic?: string
  partOfSpeech?: string
  definition?: string
  collocations: string
  examples: { en: string; zh: string }[]
}

interface EcdictEntry {
  word: string
  phonetic: string | null
  definition: string | null
  translation: string | null
  tag: string | null
}

// ========== 1. WORD LIST ==========
function getBuiltInWords(): VocabEntry[] {
  return [
    { word: 'abandon', phonetic: '/əˈbændən/', partOfSpeech: 'v.', definition: 'v. 放弃，遗弃；n. 放任，放纵', example: 'They had to abandon the sinking ship.' },
    { word: 'ability', phonetic: '/əˈbɪləti/', partOfSpeech: 'n.', definition: 'n. 能力，才能；才能，本领', example: 'She has the ability to learn languages quickly.' },
    { word: 'abolish', phonetic: '/əˈbɒlɪʃ/', partOfSpeech: 'v.', definition: 'v. 废除，废止；彻底消除', example: 'The government plans to abolish the outdated law.' },
    { word: 'absorb', phonetic: '/əbˈzɔːb/', partOfSpeech: 'v.', definition: 'v. 吸收；理解，掌握；使全神贯注', example: 'Plants absorb carbon dioxide from the air.' },
    { word: 'abstract', phonetic: '/ˈæbstrækt/', partOfSpeech: 'adj./n./v.', definition: 'adj. 抽象的；n. 摘要，概要；v. 提取，抽取', example: 'The concept of justice is quite abstract.' },
    { word: 'abundant', phonetic: '/əˈbʌndənt/', partOfSpeech: 'adj.', definition: 'adj. 丰富的，充裕的；充足的', example: 'The region has abundant natural resources.' },
    { word: 'abuse', phonetic: '/əˈbjuːs/', partOfSpeech: 'n./v.', definition: 'n./v. 滥用；虐待；辱骂', example: 'The charity aims to prevent child abuse.' },
    { word: 'academic', phonetic: '/ˌækəˈdemɪk/', partOfSpeech: 'adj./n.', definition: 'adj. 学术的；学院的；n. 学者', example: 'She has an impressive academic background.' },
    { word: 'accelerate', phonetic: '/əkˈseləreɪt/', partOfSpeech: 'v.', definition: 'v. 加速，促进；加快', example: 'Economic growth accelerated in the second quarter.' },
    { word: 'access', phonetic: '/ˈækses/', partOfSpeech: 'n./v.', definition: 'n. 进入；使用权；v. 访问，存取', example: 'Students need a password to access the online library.' },
    { word: 'accommodate', phonetic: '/əˈkɒmədeɪt/', partOfSpeech: 'v.', definition: '容纳；提供住处', example: 'The hotel can accommodate up to 300 guests.' },
    { word: 'accompany', phonetic: '/əˈkʌmpəni/', partOfSpeech: 'v.', definition: '陪伴；伴随', example: 'Children must be accompanied by an adult.' },
    { word: 'accomplish', phonetic: '/əˈkʌmplɪʃ/', partOfSpeech: 'v.', definition: '完成，实现', example: 'She accomplished her goal of running a marathon.' },
    { word: 'accumulate', phonetic: '/əˈkjuːmjəleɪt/', partOfSpeech: 'v.', definition: '积累，积聚', example: 'Dust accumulates quickly on the shelves.' },
    { word: 'accurate', phonetic: '/ˈækjərət/', partOfSpeech: 'adj.', definition: '准确的，精确的', example: 'Please make sure your measurements are accurate.' },
    { word: 'achieve', phonetic: '/əˈtʃiːv/', partOfSpeech: 'v.', definition: '实现，达到', example: 'He worked hard to achieve his dreams.' },
    { word: 'acknowledge', phonetic: '/əkˈnɒlɪdʒ/', partOfSpeech: 'v.', definition: '承认；认可', example: 'She acknowledged receiving the package.' },
    { word: 'acquire', phonetic: '/əˈkwaɪə/', partOfSpeech: 'v.', definition: '获得；收购', example: 'The company acquired a smaller competitor.' },
    { word: 'adapt', phonetic: '/əˈdæpt/', partOfSpeech: 'v.', definition: '适应；改编', example: 'Animals must adapt to their environment to survive.' },
    { word: 'adequate', phonetic: '/ˈædɪkwət/', partOfSpeech: 'adj.', definition: '足够的；适当的', example: 'The supply is not adequate for the journey.' },
    { word: 'adhere', phonetic: '/ədˈhɪə/', partOfSpeech: 'v.', definition: '遵守；附着', example: 'All members must adhere to the rules.' },
    { word: 'adjust', phonetic: '/əˈdʒʌst/', partOfSpeech: 'v.', definition: '调整，适应', example: 'It takes time to adjust to a new culture.' },
    { word: 'administer', phonetic: '/ədˈmɪnɪstə/', partOfSpeech: 'v.', definition: '管理；执行', example: 'The nurse will administer the vaccine.' },
    { word: 'adopt', phonetic: '/əˈdɒpt/', partOfSpeech: 'v.', definition: '采纳；收养', example: 'The committee adopted the new proposal.' },
    { word: 'advance', phonetic: '/ədˈvɑːns/', partOfSpeech: 'v./n.', definition: '前进；进步', example: 'Technology has advanced rapidly in recent years.' },
    { word: 'advantage', phonetic: '/ədˈvɑːntɪdʒ/', partOfSpeech: 'n.', definition: '优势，有利条件', example: 'Being bilingual is a definite advantage.' },
    { word: 'adverse', phonetic: '/ˈædvɜːs/', partOfSpeech: 'adj.', definition: '不利的；相反的', example: 'The drug may cause adverse side effects.' },
    { word: 'advocate', phonetic: '/ˈædvəkeɪt/', partOfSpeech: 'v./n.', definition: '提倡；拥护者', example: 'Many experts advocate for renewable energy.' },
    { word: 'affect', phonetic: '/əˈfekt/', partOfSpeech: 'v.', definition: '影响；感动', example: 'The weather can affect your mood significantly.' },
    { word: 'afford', phonetic: '/əˈfɔːd/', partOfSpeech: 'v.', definition: '负担得起', example: 'We cannot afford to ignore this problem.' },
    { word: 'aggressive', phonetic: '/əˈɡresɪv/', partOfSpeech: 'adj.', definition: '侵略的；有进取心的', example: 'The company launched an aggressive marketing campaign.' },
    { word: 'alleviate', phonetic: '/əˈliːvieɪt/', partOfSpeech: 'v.', definition: '减轻，缓解', example: 'The medicine helped alleviate her pain.' },
    { word: 'allocate', phonetic: '/ˈæləkeɪt/', partOfSpeech: 'v.', definition: '分配，拨出', example: 'The government allocated funds for education.' },
    { word: 'alternative', phonetic: '/ɔːlˈtɜːnətɪv/', partOfSpeech: 'n./adj.', definition: '替代方案；替代的', example: 'We need to explore alternative energy sources.' },
    { word: 'ambitious', phonetic: '/æmˈbɪʃəs/', partOfSpeech: 'adj.', definition: '雄心勃勃的', example: 'She set ambitious goals for her career.' },
    { word: 'analyse', phonetic: '/ˈænəlaɪz/', partOfSpeech: 'v.', definition: '分析，解析', example: 'Scientists analysed the data from the experiment.' },
    { word: 'ancient', phonetic: '/ˈeɪnʃənt/', partOfSpeech: 'adj.', definition: '古代的；古老的', example: 'The ancient ruins attract thousands of tourists.' },
    { word: 'annual', phonetic: '/ˈænjuəl/', partOfSpeech: 'adj.', definition: '每年的；年度的', example: 'The company publishes its annual report in March.' },
    { word: 'anticipate', phonetic: '/ænˈtɪsɪpeɪt/', partOfSpeech: 'v.', definition: '预期，预料', example: 'We anticipate strong demand for the new product.' },
    { word: 'apparent', phonetic: '/əˈpærənt/', partOfSpeech: 'adj.', definition: '显然的；表面上的', example: 'It became apparent that he was lying.' },
    { word: 'appeal', phonetic: '/əˈpiːl/', partOfSpeech: 'v./n.', definition: '呼吁；吸引；上诉', example: 'The idea of working abroad appeals to me.' },
    { word: 'application', phonetic: '/ˌæplɪˈkeɪʃn/', partOfSpeech: 'n.', definition: '申请；应用', example: 'Fill out the application form carefully.' },
    { word: 'apply', phonetic: '/əˈplaɪ/', partOfSpeech: 'v.', definition: '申请；应用', example: 'You should apply for the scholarship.' },
    { word: 'appoint', phonetic: '/əˈpɔɪnt/', partOfSpeech: 'v.', definition: '任命；指定', example: 'The board appointed a new CEO.' },
    { word: 'appreciate', phonetic: '/əˈpriːʃieɪt/', partOfSpeech: 'v.', definition: '感激；欣赏；升值', example: 'I really appreciate your help.' },
    { word: 'approach', phonetic: '/əˈprəʊtʃ/', partOfSpeech: 'v./n.', definition: '接近；方法', example: 'We need a new approach to solving this problem.' },
    { word: 'appropriate', phonetic: '/əˈprəʊpriət/', partOfSpeech: 'adj.', definition: '适当的，恰当的', example: 'Casual dress is not appropriate for the interview.' },
    { word: 'approve', phonetic: '/əˈpruːv/', partOfSpeech: 'v.', definition: '批准；赞成', example: 'The committee approved the budget proposal.' },
    { word: 'artificial', phonetic: '/ˌɑːtɪˈfɪʃl/', partOfSpeech: 'adj.', definition: '人工的；虚伪的', example: 'Artificial intelligence is transforming many industries.' },
    { word: 'assess', phonetic: '/əˈses/', partOfSpeech: 'v.', definition: '评估，评价', example: 'Teachers assess students\' performance regularly.' },
    { word: 'assign', phonetic: '/əˈsaɪn/', partOfSpeech: 'v.', definition: '分配；指定', example: 'Each student was assigned a different topic.' },
    { word: 'assist', phonetic: '/əˈsɪst/', partOfSpeech: 'v.', definition: '帮助，协助', example: 'The software assists users in managing finances.' },
    { word: 'associate', phonetic: '/əˈsəʊsieɪt/', partOfSpeech: 'v./n.', definition: '联想；联系；同事', example: 'People associate the brand with quality.' },
    { word: 'assume', phonetic: '/əˈsjuːm/', partOfSpeech: 'v.', definition: '假设；承担', example: 'I assume you have read the instructions.' },
    { word: 'atmosphere', phonetic: '/ˈætməsfɪə/', partOfSpeech: 'n.', definition: '大气；氛围', example: 'The restaurant has a warm atmosphere.' },
    { word: 'attach', phonetic: '/əˈtætʃ/', partOfSpeech: 'v.', definition: '附上；连接', example: 'Please attach your resume to the email.' },
    { word: 'attempt', phonetic: '/əˈtempt/', partOfSpeech: 'v./n.', definition: '尝试，企图', example: 'She made no attempt to hide her disappointment.' },
    { word: 'attitude', phonetic: '/ˈætɪtjuːd/', partOfSpeech: 'n.', definition: '态度；看法', example: 'A positive attitude makes a big difference.' },
    { word: 'attract', phonetic: '/əˈtrækt/', partOfSpeech: 'v.', definition: '吸引；引起', example: 'The museum attracts millions of visitors each year.' },
    { word: 'authority', phonetic: '/ɔːˈθɒrəti/', partOfSpeech: 'n.', definition: '权威；权力；当局', example: 'The local authorities are responsible for road maintenance.' },
    { word: 'available', phonetic: '/əˈveɪləbl/', partOfSpeech: 'adj.', definition: '可用的；有效的', example: 'Tickets are available online.' },
    { word: 'aware', phonetic: '/əˈweə/', partOfSpeech: 'adj.', definition: '意识到的；知道的', example: 'Are you aware of the risks involved?' },
    { word: 'barrier', phonetic: '/ˈbæriə/', partOfSpeech: 'n.', definition: '障碍；屏障', example: 'Language can be a barrier to communication.' },
    { word: 'behaviour', phonetic: '/bɪˈheɪvjə/', partOfSpeech: 'n.', definition: '行为，举止', example: 'His behaviour in class has improved.' },
    { word: 'benefit', phonetic: '/ˈbenɪfɪt/', partOfSpeech: 'n./v.', definition: '利益；好处；受益', example: 'Regular exercise has many health benefits.' },
    { word: 'budget', phonetic: '/ˈbʌdʒɪt/', partOfSpeech: 'n./v.', definition: '预算；编入预算', example: 'The project was completed within budget.' },
    { word: 'capable', phonetic: '/ˈkeɪpəbl/', partOfSpeech: 'adj.', definition: '有能力的', example: 'She is a very capable manager.' },
    { word: 'capacity', phonetic: '/kəˈpæsəti/', partOfSpeech: 'n.', definition: '容量；能力', example: 'The stadium has a seating capacity of 50,000.' },
    { word: 'category', phonetic: '/ˈkætəɡəri/', partOfSpeech: 'n.', definition: '类别，种类', example: 'The books are organized by category.' },
    { word: 'cause', phonetic: '/kɔːz/', partOfSpeech: 'v./n.', definition: '导致；原因；事业', example: 'Smoking can cause serious health problems.' },
    { word: 'challenge', phonetic: '/ˈtʃælɪndʒ/', partOfSpeech: 'n./v.', definition: '挑战；质疑', example: 'Finding a solution will be a real challenge.' },
    { word: 'characteristic', phonetic: '/ˌkærəktəˈrɪstɪk/', partOfSpeech: 'n./adj.', definition: '特征；典型的', example: 'Flexibility is a key characteristic.' },
    { word: 'circumstance', phonetic: '/ˈsɜːkəmstəns/', partOfSpeech: 'n.', definition: '情况；环境', example: 'Under no circumstances should you open the door.' },
    { word: 'claim', phonetic: '/kleɪm/', partOfSpeech: 'v./n.', definition: '声称；要求；索赔', example: 'He claims to have seen the accident.' },
    { word: 'climate', phonetic: '/ˈklaɪmət/', partOfSpeech: 'n.', definition: '气候；风气', example: 'Climate change is one of the biggest challenges we face.' },
    { word: 'collapse', phonetic: '/kəˈlæps/', partOfSpeech: 'v./n.', definition: '倒塌；崩溃', example: 'The bridge collapsed during the storm.' },
    { word: 'combine', phonetic: '/kəmˈbaɪn/', partOfSpeech: 'v.', definition: '结合；联合', example: 'The two companies combined to form a larger corporation.' },
    { word: 'communicate', phonetic: '/kəˈmjuːnɪkeɪt/', partOfSpeech: 'v.', definition: '交流；传达', example: 'It\'s important to communicate clearly with your team.' },
    { word: 'community', phonetic: '/kəˈmjuːnəti/', partOfSpeech: 'n.', definition: '社区；团体', example: 'The local community supported the new library.' },
    { word: 'compare', phonetic: '/kəmˈpeə/', partOfSpeech: 'v.', definition: '比较；对比', example: 'The report compares living standards across countries.' },
    { word: 'compensate', phonetic: '/ˈkɒmpenseɪt/', partOfSpeech: 'v.', definition: '补偿；赔偿', example: 'The insurance will compensate you for the loss.' },
    { word: 'compete', phonetic: '/kəmˈpiːt/', partOfSpeech: 'v.', definition: '竞争；比赛', example: 'Small businesses compete with large corporations.' },
    { word: 'complex', phonetic: '/ˈkɒmpleks/', partOfSpeech: 'adj./n.', definition: '复杂的；综合体', example: 'The problem is more complex than it seems.' },
    { word: 'component', phonetic: '/kəmˈpəʊnənt/', partOfSpeech: 'n.', definition: '组成部分；成分', example: 'Each component of the system must work properly.' },
    { word: 'comprehensive', phonetic: '/ˌkɒmprɪˈhensɪv/', partOfSpeech: 'adj.', definition: '全面的；综合的', example: 'The book provides a comprehensive overview.' },
    { word: 'concentrate', phonetic: '/ˈkɒnsəntreɪt/', partOfSpeech: 'v.', definition: '集中；专注', example: 'I find it hard to concentrate with the noise.' },
    { word: 'concept', phonetic: '/ˈkɒnsept/', partOfSpeech: 'n.', definition: '概念；观念', example: 'The concept of democracy originated in ancient Greece.' },
    { word: 'concern', phonetic: '/kənˈsɜːn/', partOfSpeech: 'n./v.', definition: '关心；担忧；涉及', example: 'There is growing concern about pollution.' },
    { word: 'conclude', phonetic: '/kənˈkluːd/', partOfSpeech: 'v.', definition: '总结；得出结论', example: 'The study concluded that exercise improves memory.' },
    { word: 'conduct', phonetic: '/kənˈdʌkt/', partOfSpeech: 'v./n.', definition: '实施；行为；指挥', example: 'The experiment was conducted under controlled conditions.' },
    { word: 'conference', phonetic: '/ˈkɒnfərəns/', partOfSpeech: 'n.', definition: '会议；讨论会', example: 'She is presenting at an international conference.' },
    { word: 'confident', phonetic: '/ˈkɒnfɪdənt/', partOfSpeech: 'adj.', definition: '自信的；确信的', example: 'He felt confident about passing the exam.' },
    { word: 'confirm', phonetic: '/kənˈfɜːm/', partOfSpeech: 'v.', definition: '确认；证实', example: 'Please confirm your attendance by Friday.' },
    { word: 'conflict', phonetic: '/ˈkɒnflɪkt/', partOfSpeech: 'n./v.', definition: '冲突；矛盾', example: 'The two reports are in conflict with each other.' },
    { word: 'consequence', phonetic: '/ˈkɒnsɪkwəns/', partOfSpeech: 'n.', definition: '结果；后果', example: 'He had to face the consequences of his actions.' },
    { word: 'conserve', phonetic: '/kənˈsɜːv/', partOfSpeech: 'v.', definition: '保存；节约；保护', example: 'We need to conserve water during the drought.' },
    { word: 'consider', phonetic: '/kənˈsɪdə/', partOfSpeech: 'v.', definition: '考虑；认为', example: 'Please consider all the options before deciding.' },
    { word: 'consistent', phonetic: '/kənˈsɪstənt/', partOfSpeech: 'adj.', definition: '一致的；始终如一的', example: 'His work has been consistently excellent.' },
    { word: 'constant', phonetic: '/ˈkɒnstənt/', partOfSpeech: 'adj.', definition: '不断的；持续的', example: 'The machine requires constant maintenance.' },
    { word: 'constitute', phonetic: '/ˈkɒnstɪtjuːt/', partOfSpeech: 'v.', definition: '构成；组成', example: 'Women constitute a significant portion of the workforce.' },
    { word: 'consume', phonetic: '/kənˈsjuːm/', partOfSpeech: 'v.', definition: '消费；消耗', example: 'Americans consume a large amount of energy.' },
    { word: 'contact', phonetic: '/ˈkɒntækt/', partOfSpeech: 'n./v.', definition: '接触；联系', example: 'Please contact us if you have any questions.' },
    { word: 'contemporary', phonetic: '/kənˈtempərəri/', partOfSpeech: 'adj.', definition: '当代的；同时代的', example: 'Contemporary art challenges traditional values.' },
    { word: 'contribute', phonetic: '/kənˈtrɪbjuːt/', partOfSpeech: 'v.', definition: '贡献；捐助；导致', example: 'Several factors contributed to the company\'s success.' },
    { word: 'controversy', phonetic: '/kənˈtrɒvəsi/', partOfSpeech: 'n.', definition: '争议；争论', example: 'The decision caused a lot of controversy.' },
    { word: 'convenient', phonetic: '/kənˈviːniənt/', partOfSpeech: 'adj.', definition: '方便的；便利的', example: 'Online shopping is very convenient.' },
    { word: 'convention', phonetic: '/kənˈvenʃn/', partOfSpeech: 'n.', definition: '惯例；常规；大会', example: 'By convention, the bride wears white.' },
    { word: 'convince', phonetic: '/kənˈvɪns/', partOfSpeech: 'v.', definition: '说服；使确信', example: 'She convinced me to take the job offer.' },
    { word: 'cooperate', phonetic: '/kəʊˈɒpəreɪt/', partOfSpeech: 'v.', definition: '合作，协作', example: 'The two departments need to cooperate more effectively.' },
    { word: 'coordinate', phonetic: '/kəʊˈɔːdɪneɪt/', partOfSpeech: 'v./n.', definition: '协调；调整；坐标', example: 'We need to coordinate our efforts for the project.' },
    { word: 'corporate', phonetic: '/ˈkɔːpərət/', partOfSpeech: 'adj.', definition: '公司的；法人的', example: 'Corporate culture varies from company to company.' },
    { word: 'correspond', phonetic: '/ˌkɒrəˈspɒnd/', partOfSpeech: 'v.', definition: '对应；通信', example: 'The numbers on the map correspond to buildings.' },
    { word: 'crucial', phonetic: '/ˈkruːʃl/', partOfSpeech: 'adj.', definition: '关键的；决定性的', example: 'Early detection is crucial for successful treatment.' },
    { word: 'cultivate', phonetic: '/ˈkʌltɪveɪt/', partOfSpeech: 'v.', definition: '培养；耕作；陶冶', example: 'She cultivated a reputation for being reliable.' },
    { word: 'curriculum', phonetic: '/kəˈrɪkjələm/', partOfSpeech: 'n.', definition: '课程', example: 'The school curriculum includes both arts and sciences.' },
    { word: 'database', phonetic: '/ˈdeɪtəbeɪs/', partOfSpeech: 'n.', definition: '数据库', example: 'The customer information is stored in a database.' },
    { word: 'debate', phonetic: '/dɪˈbeɪt/', partOfSpeech: 'n./v.', definition: '辩论；讨论', example: 'There is ongoing debate about climate change.' },
    { word: 'decade', phonetic: '/ˈdekeɪd/', partOfSpeech: 'n.', definition: '十年', example: 'Prices have risen significantly over the past decade.' },
    { word: 'decline', phonetic: '/dɪˈklaɪn/', partOfSpeech: 'v./n.', definition: '下降；衰退；拒绝', example: 'The population of the village has declined.' },
    { word: 'define', phonetic: '/dɪˈfaɪn/', partOfSpeech: 'v.', definition: '定义；界定', example: 'The terms need to be clearly defined.' },
    { word: 'definite', phonetic: '/ˈdefɪnət/', partOfSpeech: 'adj.', definition: '明确的；肯定的', example: 'There is a definite link between smoking and cancer.' },
    { word: 'demonstrate', phonetic: '/ˈdemənstreɪt/', partOfSpeech: 'v.', definition: '证明；演示；示范', example: 'The experiment demonstrates the principle of gravity.' },
    { word: 'depict', phonetic: '/dɪˈpɪkt/', partOfSpeech: 'v.', definition: '描绘；描述', example: 'The painting depicts a beautiful landscape.' },
    { word: 'deposit', phonetic: '/dɪˈpɒzɪt/', partOfSpeech: 'v./n.', definition: '存放；存款；押金', example: 'We paid a deposit on the apartment.' },
    { word: 'derive', phonetic: '/dɪˈraɪv/', partOfSpeech: 'v.', definition: '源自；获得', example: 'The word derives from Latin.' },
    { word: 'deserve', phonetic: '/dɪˈzɜːv/', partOfSpeech: 'v.', definition: '值得；应得', example: 'You deserve a break after all that hard work.' },
    { word: 'determine', phonetic: '/dɪˈtɜːmɪn/', partOfSpeech: 'v.', definition: '决定；确定', example: 'The results will determine our next steps.' },
    { word: 'develop', phonetic: '/dɪˈveləp/', partOfSpeech: 'v.', definition: '发展；开发；培养', example: 'The company developed a new software application.' },
    { word: 'device', phonetic: '/dɪˈvaɪs/', partOfSpeech: 'n.', definition: '设备；装置', example: 'Electronic devices must be switched off during the flight.' },
    { word: 'devote', phonetic: '/dɪˈvəʊt/', partOfSpeech: 'v.', definition: '致力于；奉献', example: 'She devoted her life to education.' },
    { word: 'dimension', phonetic: '/daɪˈmenʃn/', partOfSpeech: 'n.', definition: '维度；方面；尺寸', example: 'The problem has several dimensions to consider.' },
    { word: 'diminish', phonetic: '/dɪˈmɪnɪʃ/', partOfSpeech: 'v.', definition: '减少；减弱', example: 'The pain will diminish over time.' },
    { word: 'discipline', phonetic: '/ˈdɪsəplɪn/', partOfSpeech: 'n./v.', definition: '纪律；学科；训练', example: 'Learning a language requires discipline.' },
    { word: 'discover', phonetic: '/dɪˈskʌvə/', partOfSpeech: 'v.', definition: '发现；发觉', example: 'Scientists discovered a new species in the rainforest.' },
    { word: 'discrimination', phonetic: '/dɪˌskrɪmɪˈneɪʃn/', partOfSpeech: 'n.', definition: '歧视；辨别', example: 'Laws prohibit discrimination based on race.' },
    { word: 'display', phonetic: '/dɪˈspleɪ/', partOfSpeech: 'v./n.', definition: '展示；陈列；显示', example: 'The museum displays artifacts from ancient Egypt.' },
    { word: 'distinct', phonetic: '/dɪˈstɪŋkt/', partOfSpeech: 'adj.', definition: '不同的；明显的', example: 'There are distinct differences between the two species.' },
    { word: 'distinguish', phonetic: '/dɪˈstɪŋɡwɪʃ/', partOfSpeech: 'v.', definition: '区分；辨别', example: 'It is important to distinguish facts from opinions.' },
    { word: 'distribute', phonetic: '/dɪˈstrɪbjuːt/', partOfSpeech: 'v.', definition: '分配；分发', example: 'The charity distributes food to the needy.' },
    { word: 'diverse', phonetic: '/daɪˈvɜːs/', partOfSpeech: 'adj.', definition: '多样的；不同的', example: 'New York is a culturally diverse city.' },
    { word: 'domestic', phonetic: '/dəˈmestɪk/', partOfSpeech: 'adj.', definition: '国内的；家庭的', example: 'The domestic economy showed signs of recovery.' },
    { word: 'dominant', phonetic: '/ˈdɒmɪnənt/', partOfSpeech: 'adj.', definition: '占主导地位的', example: 'She played a dominant role in the negotiations.' },
    { word: 'dominate', phonetic: '/ˈdɒmɪneɪt/', partOfSpeech: 'v.', definition: '主导；支配', example: 'The company dominates the global market.' },
    { word: 'duration', phonetic: '/djuˈreɪʃn/', partOfSpeech: 'n.', definition: '持续时间；期间', example: 'The course has a duration of six weeks.' },
    { word: 'dynamic', phonetic: '/daɪˈnæmɪk/', partOfSpeech: 'adj./n.', definition: '动态的；有活力的', example: 'The business environment is constantly dynamic.' },
    { word: 'economy', phonetic: '/ɪˈkɒnəmi/', partOfSpeech: 'n.', definition: '经济；节省', example: 'The economy has been growing steadily.' },
    { word: 'eliminate', phonetic: '/ɪˈlɪmɪneɪt/', partOfSpeech: 'v.', definition: '消除；淘汰', example: 'We need to eliminate unnecessary costs.' },
    { word: 'emerge', phonetic: '/ɪˈmɜːdʒ/', partOfSpeech: 'v.', definition: '出现；浮现', example: 'New technologies emerge every year.' },
    { word: 'emphasis', phonetic: '/ˈemfəsɪs/', partOfSpeech: 'n.', definition: '重点；强调', example: 'The school places great emphasis on academic achievement.' },
    { word: 'employ', phonetic: '/ɪmˈplɔɪ/', partOfSpeech: 'v.', definition: '雇用；使用', example: 'The factory employs 500 workers.' },
    { word: 'enable', phonetic: '/ɪˈneɪbl/', partOfSpeech: 'v.', definition: '使能够', example: 'The scholarship enabled her to attend university.' },
    { word: 'encounter', phonetic: '/ɪnˈkaʊntə/', partOfSpeech: 'v./n.', definition: '遭遇；遇到', example: 'They encountered many difficulties on their journey.' },
    { word: 'encourage', phonetic: '/ɪnˈkʌrɪdʒ/', partOfSpeech: 'v.', definition: '鼓励；促进', example: 'Teachers should encourage students to ask questions.' },
    { word: 'engage', phonetic: '/ɪnˈɡeɪdʒ/', partOfSpeech: 'v.', definition: '参与；从事；吸引', example: 'The speaker engaged the audience with her stories.' },
    { word: 'enhance', phonetic: '/ɪnˈhɑːns/', partOfSpeech: 'v.', definition: '提高；增强', example: 'Adding spices enhances the flavor of the dish.' },
    { word: 'enormous', phonetic: '/ɪˈnɔːməs/', partOfSpeech: 'adj.', definition: '巨大的；庞大的', example: 'The project required an enormous amount of effort.' },
    { word: 'ensure', phonetic: '/ɪnˈʃʊə/', partOfSpeech: 'v.', definition: '确保；保证', example: 'Please ensure that all doors are locked.' },
    { word: 'enterprise', phonetic: '/ˈentəpraɪz/', partOfSpeech: 'n.', definition: '企业；事业', example: 'Small enterprises are the backbone of the economy.' },
    { word: 'enthusiasm', phonetic: '/ɪnˈθjuːziæzəm/', partOfSpeech: 'n.', definition: '热情；热心', example: 'She showed great enthusiasm for the project.' },
    { word: 'environment', phonetic: '/ɪnˈvaɪrənmənt/', partOfSpeech: 'n.', definition: '环境', example: 'We must protect the environment for future generations.' },
    { word: 'equipment', phonetic: '/ɪˈkwɪpmənt/', partOfSpeech: 'n.', definition: '设备；装备', example: 'The laboratory has state-of-the-art equipment.' },
    { word: 'equivalent', phonetic: '/ɪˈkwɪvələnt/', partOfSpeech: 'adj./n.', definition: '等价的；等同物', example: 'His silence was equivalent to an admission of guilt.' },
    { word: 'essential', phonetic: '/ɪˈsenʃl/', partOfSpeech: 'adj.', definition: '必要的；本质的', example: 'Water is essential for life.' },
    { word: 'establish', phonetic: '/ɪˈstæblɪʃ/', partOfSpeech: 'v.', definition: '建立；确立', example: 'The company was established in 1995.' },
    { word: 'evaluate', phonetic: '/ɪˈvæljueɪt/', partOfSpeech: 'v.', definition: '评估；评价', example: 'We need to evaluate the effectiveness of the program.' },
    { word: 'evident', phonetic: '/ˈevɪdənt/', partOfSpeech: 'adj.', definition: '明显的', example: 'It was evident that she was upset.' },
    { word: 'evolve', phonetic: '/ɪˈvɒlv/', partOfSpeech: 'v.', definition: '进化；演变', example: 'Species evolve over time in response to their environment.' },
    { word: 'exceed', phonetic: '/ɪkˈsiːd/', partOfSpeech: 'v.', definition: '超过；超越', example: 'The cost should not exceed $100.' },
    { word: 'exception', phonetic: '/ɪkˈsepʃn/', partOfSpeech: 'n.', definition: '例外', example: 'With a few exceptions, the students performed well.' },
    { word: 'excess', phonetic: '/ɪkˈses/', partOfSpeech: 'n./adj.', definition: '过量；过度的', example: 'Eating to excess is bad for your health.' },
    { word: 'exclude', phonetic: '/ɪkˈskluːd/', partOfSpeech: 'v.', definition: '排除；排斥', example: 'The price excludes tax and shipping.' },
    { word: 'exhibit', phonetic: '/ɪɡˈzɪbɪt/', partOfSpeech: 'v./n.', definition: '展览；展示', example: 'The artist will exhibit her paintings at the gallery.' },
    { word: 'expand', phonetic: '/ɪkˈspænd/', partOfSpeech: 'v.', definition: '扩展；膨胀', example: 'The company plans to expand into Asian markets.' },
    { word: 'expert', phonetic: '/ˈekspɜːt/', partOfSpeech: 'n./adj.', definition: '专家；专业的', example: 'She is an expert in environmental law.' },
    { word: 'explicit', phonetic: '/ɪkˈsplɪsɪt/', partOfSpeech: 'adj.', definition: '明确的；清楚的', example: 'The instructions were explicit and easy to follow.' },
    { word: 'exploit', phonetic: '/ɪkˈsplɔɪt/', partOfSpeech: 'v./n.', definition: '利用；开发；剥削', example: 'Companies should not exploit their workers.' },
    { word: 'expose', phonetic: '/ɪkˈspəʊz/', partOfSpeech: 'v.', definition: '暴露；揭露', example: 'The report exposed corruption in the government.' },
    { word: 'extend', phonetic: '/ɪkˈstend/', partOfSpeech: 'v.', definition: '延长；扩展', example: 'The visa can be extended for another year.' },
    { word: 'extensive', phonetic: '/ɪkˈstensɪv/', partOfSpeech: 'adj.', definition: '广泛的；大量的', example: 'The storm caused extensive damage.' },
    { word: 'external', phonetic: '/ɪkˈstɜːnl/', partOfSpeech: 'adj.', definition: '外部的；外在的', example: 'The company hired an external consultant.' },
    { word: 'extract', phonetic: '/ˈekstrækt/', partOfSpeech: 'v./n.', definition: '提取；摘录', example: 'The dentist had to extract the tooth.' },
    { word: 'facilitate', phonetic: '/fəˈsɪlɪteɪt/', partOfSpeech: 'v.', definition: '促进；使便利', example: 'New technology facilitates communication across borders.' },
    { word: 'factor', phonetic: '/ˈfæktə/', partOfSpeech: 'n.', definition: '因素；要素', example: 'Cost is an important factor in our decision.' },
    { word: 'feasible', phonetic: '/ˈfiːzəbl/', partOfSpeech: 'adj.', definition: '可行的；可能的', example: 'We need to determine if the plan is feasible.' },
    { word: 'feature', phonetic: '/ˈfiːtʃə/', partOfSpeech: 'n./v.', definition: '特征；特色', example: 'The new model features a larger screen.' },
    { word: 'finance', phonetic: '/ˈfaɪnæns/', partOfSpeech: 'n./v.', definition: '财务；金融；提供资金', example: 'The project is financed by the government.' },
    { word: 'flexible', phonetic: '/ˈfleksəbl/', partOfSpeech: 'adj.', definition: '灵活的；柔韧的', example: 'We offer flexible working hours.' },
    { word: 'fluctuate', phonetic: '/ˈflʌktʃueɪt/', partOfSpeech: 'v.', definition: '波动；变动', example: 'Stock prices fluctuate throughout the day.' },
    { word: 'focus', phonetic: '/ˈfəʊkəs/', partOfSpeech: 'v./n.', definition: '聚焦；集中；重点', example: 'We need to focus on the main issue.' },
    { word: 'forecast', phonetic: '/ˈfɔːkɑːst/', partOfSpeech: 'v./n.', definition: '预测；预报', example: 'The weather forecast predicts rain tomorrow.' },
    { word: 'foundation', phonetic: '/faʊnˈdeɪʃn/', partOfSpeech: 'n.', definition: '基础；基金会', example: 'Education provides the foundation for a successful career.' },
    { word: 'framework', phonetic: '/ˈfreɪmwɜːk/', partOfSpeech: 'n.', definition: '框架；结构；体系', example: 'The agreement provides a framework for future cooperation.' },
    { word: 'function', phonetic: '/ˈfʌŋkʃn/', partOfSpeech: 'n./v.', definition: '功能；作用；运作', example: 'The heart functions as a pump.' },
    { word: 'fundamental', phonetic: '/ˌfʌndəˈmentl/', partOfSpeech: 'adj.', definition: '基本的；根本的', example: 'There is a fundamental difference between the two theories.' },
    { word: 'generate', phonetic: '/ˈdʒenəreɪt/', partOfSpeech: 'v.', definition: '产生；生成；发(电)', example: 'The wind turbines generate electricity.' },
    { word: 'generous', phonetic: '/ˈdʒenərəs/', partOfSpeech: 'adj.', definition: '慷慨的；大方的', example: 'She made a generous donation to the charity.' },
    { word: 'global', phonetic: '/ˈɡləʊbl/', partOfSpeech: 'adj.', definition: '全球的；全面的', example: 'Global warming is a serious concern.' },
    { word: 'gradual', phonetic: '/ˈɡrædʒuəl/', partOfSpeech: 'adj.', definition: '逐渐的；渐进的', example: 'There has been a gradual increase in temperature.' },
    { word: 'guarantee', phonetic: '/ˌɡærənˈtiː/', partOfSpeech: 'v./n.', definition: '保证；担保；保修', example: 'The product comes with a two-year guarantee.' },
    { word: 'harmony', phonetic: '/ˈhɑːməni/', partOfSpeech: 'n.', definition: '和谐；融洽', example: 'The two communities lived in harmony.' },
    { word: 'hierarchy', phonetic: '/ˈhaɪərɑːki/', partOfSpeech: 'n.', definition: '等级制度', example: 'There is a clear hierarchy in the organization.' },
    { word: 'highlight', phonetic: '/ˈhaɪlaɪt/', partOfSpeech: 'v./n.', definition: '强调；突出；亮点', example: 'The report highlights the need for reform.' },
    { word: 'hypothesis', phonetic: '/haɪˈpɒθəsɪs/', partOfSpeech: 'n.', definition: '假设；假说', example: 'The scientist tested her hypothesis through experiments.' },
    { word: 'identical', phonetic: '/aɪˈdentɪkl/', partOfSpeech: 'adj.', definition: '完全相同的', example: 'The two fingerprints were identical.' },
    { word: 'identify', phonetic: '/aɪˈdentɪfaɪ/', partOfSpeech: 'v.', definition: '识别；确认；鉴定', example: 'Can you identify the problem?' },
    { word: 'ignorance', phonetic: '/ˈɪɡnərəns/', partOfSpeech: 'n.', definition: '无知；愚昧', example: 'Ignorance of the law is no excuse.' },
    { word: 'illustrate', phonetic: '/ˈɪləstreɪt/', partOfSpeech: 'v.', definition: '说明；阐明', example: 'The data illustrates the point perfectly.' },
    { word: 'image', phonetic: '/ˈɪmɪdʒ/', partOfSpeech: 'n.', definition: '图像；形象；印象', example: 'The company is trying to improve its public image.' },
    { word: 'immense', phonetic: '/ɪˈmens/', partOfSpeech: 'adj.', definition: '巨大的；无边的', example: 'The project required an immense amount of work.' },
    { word: 'immigrant', phonetic: '/ˈɪmɪɡrənt/', partOfSpeech: 'n.', definition: '移民；侨民', example: 'The city has a large immigrant population.' },
    { word: 'impact', phonetic: '/ˈɪmpækt/', partOfSpeech: 'n./v.', definition: '影响；冲击', example: 'Technology has had a huge impact on our lives.' },
    { word: 'implement', phonetic: '/ˈɪmplɪment/', partOfSpeech: 'v./n.', definition: '实施；执行；工具', example: 'The new policy will be implemented next month.' },
    { word: 'implication', phonetic: '/ˌɪmplɪˈkeɪʃn/', partOfSpeech: 'n.', definition: '含义；暗示；影响', example: 'The implications of the decision are far-reaching.' },
    { word: 'impose', phonetic: '/ɪmˈpəʊz/', partOfSpeech: 'v.', definition: '强加；征收(税)', example: 'The government imposed a tax on sugary drinks.' },
    { word: 'impressive', phonetic: '/ɪmˈpresɪv/', partOfSpeech: 'adj.', definition: '令人印象深刻的', example: 'Her performance was truly impressive.' },
    { word: 'incentive', phonetic: '/ɪnˈsentɪv/', partOfSpeech: 'n.', definition: '激励；奖励', example: 'Financial incentives encourage people to work harder.' },
    { word: 'incident', phonetic: '/ˈɪnsɪdənt/', partOfSpeech: 'n.', definition: '事件；事故', example: 'The incident was reported to the police.' },
    { word: 'incorporate', phonetic: '/ɪnˈkɔːpəreɪt/', partOfSpeech: 'v.', definition: '合并；包含；吸收', example: 'We incorporated feedback from customers into the design.' },
    { word: 'indicate', phonetic: '/ˈɪndɪkeɪt/', partOfSpeech: 'v.', definition: '表明；指示', example: 'The results indicate that the treatment is effective.' },
    { word: 'individual', phonetic: '/ˌɪndɪˈvɪdʒuəl/', partOfSpeech: 'adj./n.', definition: '个人的；单独的；个体', example: 'Each individual has their own strengths.' },
    { word: 'inevitable', phonetic: '/ɪnˈevɪtəbl/', partOfSpeech: 'adj.', definition: '不可避免的', example: 'Change is inevitable in any organization.' },
    { word: 'infer', phonetic: '/ɪnˈfɜː/', partOfSpeech: 'v.', definition: '推断；推论', example: 'From the evidence, we can infer that he is guilty.' },
    { word: 'influence', phonetic: '/ˈɪnfluəns/', partOfSpeech: 'n./v.', definition: '影响；势力', example: 'Social media has a strong influence on young people.' },
    { word: 'inform', phonetic: '/ɪnˈfɔːm/', partOfSpeech: 'v.', definition: '通知；告知', example: 'Please inform us of any changes.' },
    { word: 'ingredient', phonetic: '/ɪnˈɡriːdiənt/', partOfSpeech: 'n.', definition: '成分；原料；要素', example: 'Trust is an essential ingredient in any relationship.' },
    { word: 'inhabit', phonetic: '/ɪnˈhæbɪt/', partOfSpeech: 'v.', definition: '居住于；栖息', example: 'The island is inhabited by various species of birds.' },
    { word: 'initial', phonetic: '/ɪˈnɪʃl/', partOfSpeech: 'adj.', definition: '最初的；开始的', example: 'Her initial reaction was one of shock.' },
    { word: 'initiate', phonetic: '/ɪˈnɪʃieɪt/', partOfSpeech: 'v.', definition: '开始；发起', example: 'The government initiated a new healthcare program.' },
    { word: 'innovation', phonetic: '/ˌɪnəˈveɪʃn/', partOfSpeech: 'n.', definition: '创新；革新', example: 'Innovation is key to staying competitive.' },
    { word: 'input', phonetic: '/ˈɪnpʊt/', partOfSpeech: 'n./v.', definition: '输入；投入；意见', example: 'We value your input on this matter.' },
    { word: 'inspiration', phonetic: '/ˌɪnspəˈreɪʃn/', partOfSpeech: 'n.', definition: '灵感；鼓舞', example: 'She draws inspiration from nature.' },
    { word: 'institute', phonetic: '/ˈɪnstɪtjuːt/', partOfSpeech: 'n./v.', definition: '机构；学院；建立', example: 'The research institute focuses on climate studies.' },
    { word: 'institution', phonetic: '/ˌɪnstɪˈtjuːʃn/', partOfSpeech: 'n.', definition: '机构；制度；惯例', example: 'Marriage is a social institution.' },
    { word: 'instrument', phonetic: '/ˈɪnstrəmənt/', partOfSpeech: 'n.', definition: '工具；仪器；乐器', example: 'The surgeon used a specialized instrument.' },
    { word: 'integrate', phonetic: '/ˈɪntɪɡreɪt/', partOfSpeech: 'v.', definition: '整合；融入', example: 'The new system integrates with existing software.' },
    { word: 'intellectual', phonetic: '/ˌɪntəˈlektʃuəl/', partOfSpeech: 'adj./n.', definition: '智力的；知识分子', example: 'Chess is an intellectual game.' },
    { word: 'intelligent', phonetic: '/ɪnˈtelɪdʒənt/', partOfSpeech: 'adj.', definition: '聪明的；智能的', example: 'She is an intelligent and capable leader.' },
    { word: 'intense', phonetic: '/ɪnˈtens/', partOfSpeech: 'adj.', definition: '强烈的；紧张的', example: 'The training was physically intense.' },
    { word: 'interact', phonetic: '/ˌɪntərˈækt/', partOfSpeech: 'v.', definition: '互动；相互作用', example: 'The teacher encourages students to interact.' },
    { word: 'intermediate', phonetic: '/ˌɪntəˈmiːdiət/', partOfSpeech: 'adj.', definition: '中级的；中间的', example: 'She signed up for an intermediate English course.' },
    { word: 'internal', phonetic: '/ɪnˈtɜːnl/', partOfSpeech: 'adj.', definition: '内部的；国内的', example: 'The company is conducting an internal investigation.' },
    { word: 'interpret', phonetic: '/ɪnˈtɜːprɪt/', partOfSpeech: 'v.', definition: '解释；口译；理解', example: 'How do you interpret these statistics?' },
    { word: 'interval', phonetic: '/ˈɪntəvl/', partOfSpeech: 'n.', definition: '间隔；间歇', example: 'The interval between sessions is 15 minutes.' },
    { word: 'intervene', phonetic: '/ˌɪntəˈviːn/', partOfSpeech: 'v.', definition: '干预；介入', example: 'The government had to intervene in the crisis.' },
    { word: 'intrinsic', phonetic: '/ɪnˈtrɪnsɪk/', partOfSpeech: 'adj.', definition: '固有的；内在的', example: 'There is intrinsic value in education.' },
    { word: 'investigate', phonetic: '/ɪnˈvestɪɡeɪt/', partOfSpeech: 'v.', definition: '调查；研究', example: 'The police are investigating the crime.' },
    { word: 'investment', phonetic: '/ɪnˈvestmənt/', partOfSpeech: 'n.', definition: '投资；投入', example: 'Education is an investment in the future.' },
    { word: 'isolate', phonetic: '/ˈaɪsəleɪt/', partOfSpeech: 'v.', definition: '隔离；孤立', example: 'The patient was isolated to prevent the spread of infection.' },
    { word: 'issue', phonetic: '/ˈɪʃuː/', partOfSpeech: 'n./v.', definition: '问题；议题；发行', example: 'Climate change is a pressing issue.' },
    { word: 'journal', phonetic: '/ˈdʒɜːnl/', partOfSpeech: 'n.', definition: '期刊；日记', example: 'She published her research in a scientific journal.' },
    { word: 'justify', phonetic: '/ˈdʒʌstɪfaɪ/', partOfSpeech: 'v.', definition: '证明…有理', example: 'How can you justify such a high price?' },
    { word: 'label', phonetic: '/ˈleɪbl/', partOfSpeech: 'n./v.', definition: '标签；标记', example: 'Read the label on the package for instructions.' },
    { word: 'labour', phonetic: '/ˈleɪbə/', partOfSpeech: 'n./v.', definition: '劳动；工作；劳动力', example: 'The construction requires skilled labour.' },
    { word: 'launch', phonetic: '/lɔːntʃ/', partOfSpeech: 'v./n.', definition: '发射；启动；推出', example: 'The company launched a new smartphone.' },
    { word: 'layer', phonetic: '/ˈleɪə/', partOfSpeech: 'n.', definition: '层；层次', example: 'The ozone layer protects us from UV radiation.' },
    { word: 'lecture', phonetic: '/ˈlektʃə/', partOfSpeech: 'n./v.', definition: '讲座；讲课', example: 'The professor gave a fascinating lecture.' },
    { word: 'legal', phonetic: '/ˈliːɡl/', partOfSpeech: 'adj.', definition: '法律的；合法的', example: 'You should seek legal advice.' },
    { word: 'legislation', phonetic: '/ˌledʒɪsˈleɪʃn/', partOfSpeech: 'n.', definition: '立法；法规', example: 'New legislation on data privacy was passed.' },
    { word: 'legitimate', phonetic: '/lɪˈdʒɪtɪmət/', partOfSpeech: 'adj.', definition: '合法的；合理的', example: 'That is a legitimate concern.' },
    { word: 'liberal', phonetic: '/ˈlɪbərəl/', partOfSpeech: 'adj.', definition: '自由的；开明的', example: 'She has liberal views on social issues.' },
    { word: 'likelihood', phonetic: '/ˈlaɪklihʊd/', partOfSpeech: 'n.', definition: '可能性；概率', example: 'There is a strong likelihood of rain today.' },
    { word: 'linguistic', phonetic: '/lɪŋˈɡwɪstɪk/', partOfSpeech: 'adj.', definition: '语言的；语言学的', example: 'The child has advanced linguistic skills.' },
    { word: 'literacy', phonetic: '/ˈlɪtərəsi/', partOfSpeech: 'n.', definition: '读写能力；文化素养', example: 'The program aims to improve adult literacy.' },
    { word: 'logical', phonetic: '/ˈlɒdʒɪkl/', partOfSpeech: 'adj.', definition: '逻辑的；合情合理的', example: 'Her argument is logical and well-structured.' },
    { word: 'maintain', phonetic: '/meɪnˈteɪn/', partOfSpeech: 'v.', definition: '保持；维持；保养', example: 'It is important to maintain a healthy lifestyle.' },
    { word: 'major', phonetic: '/ˈmeɪdʒə/', partOfSpeech: 'adj./n./v.', definition: '主要的；主修', example: 'The major challenge is funding.' },
    { word: 'manipulate', phonetic: '/məˈnɪpjuleɪt/', partOfSpeech: 'v.', definition: '操控；操纵', example: 'The data was manipulated to support the conclusion.' },
    { word: 'margin', phonetic: '/ˈmɑːdʒɪn/', partOfSpeech: 'n.', definition: '边缘；余量；利润', example: 'The company operates on thin profit margins.' },
    { word: 'mature', phonetic: '/məˈtʃʊə/', partOfSpeech: 'adj./v.', definition: '成熟的', example: 'She has a mature approach to problem-solving.' },
    { word: 'maximum', phonetic: '/ˈmæksɪməm/', partOfSpeech: 'adj./n.', definition: '最大的；最大值', example: 'The maximum speed on this road is 70 mph.' },
    { word: 'mechanism', phonetic: '/ˈmekənɪzəm/', partOfSpeech: 'n.', definition: '机制；机理', example: 'The market mechanism determines prices.' },
    { word: 'media', phonetic: '/ˈmiːdiə/', partOfSpeech: 'n.', definition: '媒体；媒介', example: 'The story was widely covered in the media.' },
    { word: 'mental', phonetic: '/ˈmentl/', partOfSpeech: 'adj.', definition: '精神的；心理的', example: 'Mental health is just as important as physical health.' },
    { word: 'method', phonetic: '/ˈmeθəd/', partOfSpeech: 'n.', definition: '方法；办法', example: 'We need to find a more effective method.' },
    { word: 'migrate', phonetic: '/maɪˈɡreɪt/', partOfSpeech: 'v.', definition: '迁移；移居；迁徙', example: 'Birds migrate south for the winter.' },
    { word: 'military', phonetic: '/ˈmɪlətri/', partOfSpeech: 'adj./n.', definition: '军事的；军队', example: 'The military intervened in the conflict.' },
    { word: 'minimum', phonetic: '/ˈmɪnɪməm/', partOfSpeech: 'adj./n.', definition: '最小的；最低限度', example: 'A minimum of two years of experience is required.' },
    { word: 'minor', phonetic: '/ˈmaɪnə/', partOfSpeech: 'adj./n.', definition: '次要的；较小的', example: 'He played a minor role in the project.' },
    { word: 'modify', phonetic: '/ˈmɒdɪfaɪ/', partOfSpeech: 'v.', definition: '修改；调整', example: 'We may need to modify the original plan.' },
    { word: 'monitor', phonetic: '/ˈmɒnɪtə/', partOfSpeech: 'v./n.', definition: '监控；监测', example: 'Doctors monitor patients\' vital signs.' },
    { word: 'moral', phonetic: '/ˈmɒrəl/', partOfSpeech: 'adj./n.', definition: '道德的；伦理的；寓意', example: 'The story has a moral lesson.' },
    { word: 'motivate', phonetic: '/ˈməʊtɪveɪt/', partOfSpeech: 'v.', definition: '激励；激发', example: 'A good teacher motivates students to learn.' },
    { word: 'mutual', phonetic: '/ˈmjuːtʃuəl/', partOfSpeech: 'adj.', definition: '相互的；共同的', example: 'The partnership is based on mutual respect.' },
    { word: 'negative', phonetic: '/ˈneɡətɪv/', partOfSpeech: 'adj./n.', definition: '消极的；负面的', example: 'The film received negative reviews.' },
    { word: 'negotiate', phonetic: '/nɪˈɡəʊʃieɪt/', partOfSpeech: 'v.', definition: '谈判；协商', example: 'The union is negotiating for better pay.' },
    { word: 'network', phonetic: '/ˈnetwɜːk/', partOfSpeech: 'n./v.', definition: '网络；关系网', example: 'Building a professional network is important.' },
    { word: 'neutral', phonetic: '/ˈnjuːtrəl/', partOfSpeech: 'adj.', definition: '中立的；中性的', example: 'Switzerland remained neutral during the war.' },
    { word: 'nevertheless', phonetic: '/ˌnevəðəˈles/', partOfSpeech: 'adv.', definition: '然而；尽管如此', example: 'The experiment failed; nevertheless, we learned a lot.' },
    { word: 'notion', phonetic: '/ˈnəʊʃn/', partOfSpeech: 'n.', definition: '概念；看法', example: 'She has a romantic notion of life in Paris.' },
    { word: 'nuclear', phonetic: '/ˈnjuːkliə/', partOfSpeech: 'adj.', definition: '核的；原子能的', example: 'Nuclear energy provides a significant portion of electricity.' },
    { word: 'objective', phonetic: '/əbˈdʒektɪv/', partOfSpeech: 'n./adj.', definition: '目标；客观的', example: 'Our main objective is to increase sales.' },
    { word: 'obtain', phonetic: '/əbˈteɪn/', partOfSpeech: 'v.', definition: '获得；得到', example: 'You need to obtain a visa before traveling.' },
    { word: 'obvious', phonetic: '/ˈɒbviəs/', partOfSpeech: 'adj.', definition: '明显的；显然的', example: 'It was obvious that she was lying.' },
    { word: 'occupation', phonetic: '/ˌɒkjuˈpeɪʃn/', partOfSpeech: 'n.', definition: '职业；占领', example: 'Please state your occupation on the form.' },
    { word: 'occur', phonetic: '/əˈkɜː/', partOfSpeech: 'v.', definition: '发生；出现', example: 'The accident occurred late at night.' },
    { word: 'offend', phonetic: '/əˈfend/', partOfSpeech: 'v.', definition: '冒犯；得罪', example: 'I\'m sorry if I offended you.' },
    { word: 'operate', phonetic: '/ˈɒpəreɪt/', partOfSpeech: 'v.', definition: '操作；运营；动手术', example: 'The machine operates 24 hours a day.' },
    { word: 'opinion', phonetic: '/əˈpɪnjən/', partOfSpeech: 'n.', definition: '意见；看法', example: 'In my opinion, this is the best solution.' },
    { word: 'opponent', phonetic: '/əˈpəʊnənt/', partOfSpeech: 'n.', definition: '对手；反对者', example: 'She defeated her opponent in the debate.' },
    { word: 'opportunity', phonetic: '/ˌɒpəˈtjuːnəti/', partOfSpeech: 'n.', definition: '机会；机遇', example: 'This is a great opportunity to learn.' },
    { word: 'oppose', phonetic: '/əˈpəʊz/', partOfSpeech: 'v.', definition: '反对；抵制', example: 'Many people oppose the new policy.' },
    { word: 'optimistic', phonetic: '/ˌɒptɪˈmɪstɪk/', partOfSpeech: 'adj.', definition: '乐观的', example: 'He remains optimistic about the future.' },
    { word: 'option', phonetic: '/ˈɒpʃn/', partOfSpeech: 'n.', definition: '选择；选项', example: 'We have several options to consider.' },
    { word: 'organic', phonetic: '/ɔːˈɡænɪk/', partOfSpeech: 'adj.', definition: '有机的；器官的', example: 'Organic food is grown without chemicals.' },
    { word: 'orientation', phonetic: '/ˌɔːriənˈteɪʃn/', partOfSpeech: 'n.', definition: '方向；定位；入职培训', example: 'The company provides orientation for new employees.' },
    { word: 'origin', phonetic: '/ˈɒrɪdʒɪn/', partOfSpeech: 'n.', definition: '起源；渊源', example: 'The word has Latin origins.' },
    { word: 'outcome', phonetic: '/ˈaʊtkʌm/', partOfSpeech: 'n.', definition: '结果；结局', example: 'We are waiting for the outcome of the election.' },
    { word: 'output', phonetic: '/ˈaʊtpʊt/', partOfSpeech: 'n./v.', definition: '产出；输出；产量', example: 'The factory increased its output.' },
    { word: 'overall', phonetic: '/ˌəʊvərˈɔːl/', partOfSpeech: 'adj./adv.', definition: '总体的；全面地', example: 'The overall cost of the project is $5 million.' },
    { word: 'overcome', phonetic: '/ˌəʊvəˈkʌm/', partOfSpeech: 'v.', definition: '克服；战胜', example: 'She overcame many obstacles to achieve her goals.' },
    { word: 'overlap', phonetic: '/ˌəʊvəˈlæp/', partOfSpeech: 'v./n.', definition: '重叠；重合', example: 'The two subjects overlap significantly.' },
    { word: 'overseas', phonetic: '/ˌəʊvəˈsiːz/', partOfSpeech: 'adj./adv.', definition: '海外的；在海外', example: 'He is studying overseas.' },
    { word: 'panel', phonetic: '/ˈpænl/', partOfSpeech: 'n.', definition: '面板；专家组', example: 'A panel of experts will evaluate the proposals.' },
    { word: 'paradigm', phonetic: '/ˈpærədaɪm/', partOfSpeech: 'n.', definition: '范式；典范', example: 'This discovery represents a paradigm shift.' },
    { word: 'parallel', phonetic: '/ˈpærəlel/', partOfSpeech: 'adj./n./v.', definition: '平行的；类似的', example: 'There are parallel developments in both countries.' },
    { word: 'participate', phonetic: '/pɑːˈtɪsɪpeɪt/', partOfSpeech: 'v.', definition: '参与；参加', example: 'Students are encouraged to participate in class.' },
    { word: 'passion', phonetic: '/ˈpæʃn/', partOfSpeech: 'n.', definition: '激情；热情', example: 'She has a passion for music.' },
    { word: 'passive', phonetic: '/ˈpæsɪv/', partOfSpeech: 'adj.', definition: '被动的；消极的', example: 'He took a passive role in the discussion.' },
    { word: 'patent', phonetic: '/ˈpætnt/', partOfSpeech: 'n./v.', definition: '专利；获得专利', example: 'The company holds several patents.' },
    { word: 'patience', phonetic: '/ˈpeɪʃns/', partOfSpeech: 'n.', definition: '耐心；忍耐力', example: 'You need a lot of patience for this job.' },
    { word: 'pattern', phonetic: '/ˈpætn/', partOfSpeech: 'n.', definition: '模式；图案', example: 'The weather pattern has changed dramatically.' },
    { word: 'peak', phonetic: '/piːk/', partOfSpeech: 'n./adj./v.', definition: '顶峰；最高的', example: 'Traffic reaches its peak at 5 pm.' },
    { word: 'penalty', phonetic: '/ˈpenəlti/', partOfSpeech: 'n.', definition: '处罚；惩罚', example: 'The penalty for late payment is $50.' },
    { word: 'perceive', phonetic: '/pəˈsiːv/', partOfSpeech: 'v.', definition: '察觉；感知；理解', example: 'How do you perceive the situation?' },
    { word: 'period', phonetic: '/ˈpɪəriəd/', partOfSpeech: 'n.', definition: '时期；周期', example: 'The project will run for a period of six months.' },
    { word: 'permanent', phonetic: '/ˈpɜːmənənt/', partOfSpeech: 'adj.', definition: '永久的；长期的', example: 'She found a permanent job in the city.' },
    { word: 'permit', phonetic: '/pəˈmɪt/', partOfSpeech: 'v./n.', definition: '允许；许可；许可证', example: 'Smoking is not permitted in the building.' },
    { word: 'persist', phonetic: '/pəˈsɪst/', partOfSpeech: 'v.', definition: '坚持；持续', example: 'If symptoms persist, consult a doctor.' },
    { word: 'personnel', phonetic: '/ˌpɜːsəˈnel/', partOfSpeech: 'n.', definition: '人员；员工；人事部门', example: 'All personnel must attend the safety training.' },
    { word: 'perspective', phonetic: '/pəˈspektɪv/', partOfSpeech: 'n.', definition: '视角；观点；透视', example: 'Let\'s look at this from a different perspective.' },
    { word: 'phenomenon', phonetic: '/fəˈnɒmɪnən/', partOfSpeech: 'n.', definition: '现象', example: 'The phenomenon occurs in many countries.' },
    { word: 'philosophy', phonetic: '/fəˈlɒsəfi/', partOfSpeech: 'n.', definition: '哲学；人生观', example: 'The company\'s philosophy is customer first.' },
    { word: 'physical', phonetic: '/ˈfɪzɪkl/', partOfSpeech: 'adj.', definition: '物理的；身体的', example: 'Regular physical activity is important.' },
    { word: 'pioneer', phonetic: '/ˌpaɪəˈnɪə/', partOfSpeech: 'n./v.', definition: '先驱；开拓者', example: 'She was a pioneer in the field of genetics.' },
    { word: 'policy', phonetic: '/ˈpɒləsi/', partOfSpeech: 'n.', definition: '政策；方针', example: 'The company has a strict no-smoking policy.' },
    { word: 'pollution', phonetic: '/pəˈluːʃn/', partOfSpeech: 'n.', definition: '污染', example: 'Air pollution is a major health risk.' },
    { word: 'population', phonetic: '/ˌpɒpjuˈleɪʃn/', partOfSpeech: 'n.', definition: '人口；种群', example: 'The world population continues to grow.' },
    { word: 'portion', phonetic: '/ˈpɔːʃn/', partOfSpeech: 'n.', definition: '部分；一份', example: 'Only a small portion of the budget remains.' },
    { word: 'pose', phonetic: '/pəʊz/', partOfSpeech: 'v./n.', definition: '造成；提出；姿态', example: 'The new law poses a threat to small businesses.' },
    { word: 'positive', phonetic: '/ˈpɒzətɪv/', partOfSpeech: 'adj.', definition: '积极的；正面的', example: 'Try to maintain a positive attitude.' },
    { word: 'possess', phonetic: '/pəˈzes/', partOfSpeech: 'v.', definition: '拥有；具有', example: 'She possesses excellent leadership skills.' },
    { word: 'potential', phonetic: '/pəˈtenʃl/', partOfSpeech: 'adj./n.', definition: '潜在的；潜力', example: 'The young athlete has great potential.' },
    { word: 'poverty', phonetic: '/ˈpɒvəti/', partOfSpeech: 'n.', definition: '贫穷；贫困', example: 'Many people live below the poverty line.' },
    { word: 'practical', phonetic: '/ˈpræktɪkl/', partOfSpeech: 'adj.', definition: '实际的；实用的', example: 'The course is very practical and hands-on.' },
    { word: 'precede', phonetic: '/prɪˈsiːd/', partOfSpeech: 'v.', definition: '在…之前', example: 'The discussion was preceded by a short presentation.' },
    { word: 'precise', phonetic: '/prɪˈsaɪs/', partOfSpeech: 'adj.', definition: '精确的；准确的', example: 'You need to take precise measurements.' },
    { word: 'predict', phonetic: '/prɪˈdɪkt/', partOfSpeech: 'v.', definition: '预测；预言', example: 'Economists predict a recession next year.' },
    { word: 'prefer', phonetic: '/prɪˈfɜː/', partOfSpeech: 'v.', definition: '更喜欢；偏爱', example: 'I prefer tea to coffee.' },
    { word: 'prejudice', phonetic: '/ˈpredʒudɪs/', partOfSpeech: 'n./v.', definition: '偏见；歧视', example: 'We must overcome racial prejudice.' },
    { word: 'preliminary', phonetic: '/prɪˈlɪmɪnəri/', partOfSpeech: 'adj.', definition: '初步的；预备的', example: 'The preliminary results look promising.' },
    { word: 'premise', phonetic: '/ˈpremɪs/', partOfSpeech: 'n.', definition: '前提；假定', example: 'The argument is based on a false premise.' },
    { word: 'prescribe', phonetic: '/prɪˈskraɪb/', partOfSpeech: 'v.', definition: '开药方；规定', example: 'The doctor prescribed antibiotics.' },
    { word: 'preserve', phonetic: '/prɪˈzɜːv/', partOfSpeech: 'v./n.', definition: '保存；保护；保鲜', example: 'We need to preserve historical buildings.' },
    { word: 'pressure', phonetic: '/ˈpreʃə/', partOfSpeech: 'n./v.', definition: '压力；压强', example: 'He works well under pressure.' },
    { word: 'prevail', phonetic: '/prɪˈveɪl/', partOfSpeech: 'v.', definition: '盛行；占上风', example: 'Justice will prevail in the end.' },
    { word: 'previous', phonetic: '/ˈpriːviəs/', partOfSpeech: 'adj.', definition: '以前的；先前的', example: 'In previous years, the event was smaller.' },
    { word: 'primary', phonetic: '/ˈpraɪməri/', partOfSpeech: 'adj.', definition: '主要的；首要的', example: 'The primary goal is to reduce costs.' },
    { word: 'principal', phonetic: '/ˈprɪnsəpl/', partOfSpeech: 'adj./n.', definition: '主要的；校长；本金', example: 'The principal cause of the accident was human error.' },
    { word: 'principle', phonetic: '/ˈprɪnsəpl/', partOfSpeech: 'n.', definition: '原则；原理', example: 'We must adhere to our principles.' },
    { word: 'priority', phonetic: '/praɪˈɒrəti/', partOfSpeech: 'n.', definition: '优先；重点', example: 'Safety should be our top priority.' },
    { word: 'procedure', phonetic: '/prəˈsiːdʒə/', partOfSpeech: 'n.', definition: '程序；步骤', example: 'Follow the standard procedure for handling complaints.' },
    { word: 'process', phonetic: '/ˈprəʊses/', partOfSpeech: 'n./v.', definition: '过程；流程；处理', example: 'The application process takes about two weeks.' },
    { word: 'profession', phonetic: '/prəˈfeʃn/', partOfSpeech: 'n.', definition: '职业；专业', example: 'Teaching is a rewarding profession.' },
    { word: 'profit', phonetic: '/ˈprɒfɪt/', partOfSpeech: 'n./v.', definition: '利润；利益', example: 'The company made a good profit this year.' },
    { word: 'profound', phonetic: '/prəˈfaʊnd/', partOfSpeech: 'adj.', definition: '深刻的；深远的', example: 'The experience had a profound impact on her.' },
    { word: 'progress', phonetic: '/ˈprəʊɡres/', partOfSpeech: 'n./v.', definition: '进步；进展', example: 'We have made significant progress.' },
    { word: 'prohibit', phonetic: '/prəˈhɪbɪt/', partOfSpeech: 'v.', definition: '禁止；阻止', example: 'Smoking is prohibited in this area.' },
    { word: 'project', phonetic: '/ˈprɒdʒekt/', partOfSpeech: 'n./v.', definition: '项目；工程；计划；投射', example: 'The construction project will take two years.' },
    { word: 'promote', phonetic: '/prəˈməʊt/', partOfSpeech: 'v.', definition: '促进；推广；晋升', example: 'The campaign promotes healthy eating.' },
    { word: 'proportion', phonetic: '/prəˈpɔːʃn/', partOfSpeech: 'n.', definition: '比例；部分', example: 'A large proportion of the budget is spent on salaries.' },
    { word: 'prospect', phonetic: '/ˈprɒspekt/', partOfSpeech: 'n./v.', definition: '前景；展望', example: 'The job prospects in this field are excellent.' },
    { word: 'prosperity', phonetic: '/prɒˈsperəti/', partOfSpeech: 'n.', definition: '繁荣；富裕', example: 'The country enjoyed a period of prosperity.' },
    { word: 'protocol', phonetic: '/ˈprəʊtəkɒl/', partOfSpeech: 'n.', definition: '协议；规程', example: 'The experiment followed standard protocols.' },
    { word: 'provide', phonetic: '/prəˈvaɪd/', partOfSpeech: 'v.', definition: '提供；供应', example: 'The hotel provides free Wi-Fi for guests.' },
    { word: 'provoke', phonetic: '/prəˈvəʊk/', partOfSpeech: 'v.', definition: '激起；引发', example: 'The comment provoked anger among listeners.' },
    { word: 'publish', phonetic: '/ˈpʌblɪʃ/', partOfSpeech: 'v.', definition: '出版；发表', example: 'She published her first novel at age 25.' },
    { word: 'purchase', phonetic: '/ˈpɜːtʃəs/', partOfSpeech: 'v./n.', definition: '购买；采购', example: 'You can purchase tickets online.' },
    { word: 'pursue', phonetic: '/pəˈsjuː/', partOfSpeech: 'v.', definition: '追求；追赶；从事', example: 'She decided to pursue a career in law.' },
    { word: 'qualify', phonetic: '/ˈkwɒlɪfaɪ/', partOfSpeech: 'v.', definition: '使合格；具备资格', example: 'You need to qualify for the competition.' },
    { word: 'quantity', phonetic: '/ˈkwɒntɪti/', partOfSpeech: 'n.', definition: '数量；大量', example: 'The quantity of data collected is enormous.' },
    { word: 'radical', phonetic: '/ˈrædɪkl/', partOfSpeech: 'adj./n.', definition: '根本的；激进的', example: 'The company needs radical change.' },
    { word: 'range', phonetic: '/reɪndʒ/', partOfSpeech: 'n./v.', definition: '范围；幅度；(在一定范围内)变化', example: 'The price range is from $10 to $50.' },
    { word: 'rapid', phonetic: '/ˈræpɪd/', partOfSpeech: 'adj.', definition: '迅速的；快速的', example: 'There has been rapid growth in the tech sector.' },
    { word: 'rational', phonetic: '/ˈræʃnəl/', partOfSpeech: 'adj.', definition: '理性的；合理的', example: 'We need to make a rational decision.' },
    { word: 'react', phonetic: '/riˈækt/', partOfSpeech: 'v.', definition: '反应；回应', example: 'How did she react to the news?' },
    { word: 'realistic', phonetic: '/ˌriːəˈlɪstɪk/', partOfSpeech: 'adj.', definition: '现实的；实际的', example: 'We need to set realistic goals.' },
    { word: 'recession', phonetic: '/rɪˈseʃn/', partOfSpeech: 'n.', definition: '经济衰退', example: 'The economy is in a deep recession.' },
    { word: 'recognition', phonetic: '/ˌrekəɡˈnɪʃn/', partOfSpeech: 'n.', definition: '识别；认可；承认', example: 'She received recognition for her work.' },
    { word: 'recommend', phonetic: '/ˌrekəˈmend/', partOfSpeech: 'v.', definition: '推荐；建议', example: 'I would recommend this book to anyone.' },
    { word: 'recover', phonetic: '/rɪˈkʌvə/', partOfSpeech: 'v.', definition: '恢复；康复', example: 'It took her weeks to recover from the illness.' },
    { word: 'refer', phonetic: '/rɪˈfɜː/', partOfSpeech: 'v.', definition: '提及；参考', example: 'Please refer to the user manual.' },
    { word: 'reflect', phonetic: '/rɪˈflekt/', partOfSpeech: 'v.', definition: '反映；反射；思考', example: 'The results reflect the hard work of the team.' },
    { word: 'reform', phonetic: '/rɪˈfɔːm/', partOfSpeech: 'v./n.', definition: '改革；革新', example: 'The government introduced education reforms.' },
    { word: 'regardless', phonetic: '/rɪˈɡɑːdləs/', partOfSpeech: 'adv.', definition: '不管；无论如何', example: 'The law applies to everyone, regardless of status.' },
    { word: 'region', phonetic: '/ˈriːdʒən/', partOfSpeech: 'n.', definition: '地区；区域', example: 'The region is known for its wine production.' },
    { word: 'register', phonetic: '/ˈredʒɪstə/', partOfSpeech: 'v./n.', definition: '登记；注册', example: 'You need to register for the course.' },
    { word: 'regulate', phonetic: '/ˈreɡjuleɪt/', partOfSpeech: 'v.', definition: '调节；管理；控制', example: 'The government regulates the banking industry.' },
    { word: 'reinforce', phonetic: '/ˌriːɪnˈfɔːs/', partOfSpeech: 'v.', definition: '加强；强化', example: 'The argument is reinforced by new evidence.' },
    { word: 'reject', phonetic: '/rɪˈdʒekt/', partOfSpeech: 'v./n.', definition: '拒绝；排斥', example: 'The board rejected the proposal.' },
    { word: 'relate', phonetic: '/rɪˈleɪt/', partOfSpeech: 'v.', definition: '有关；涉及；产生共鸣', example: 'I can relate to what you\'re saying.' },
    { word: 'release', phonetic: '/rɪˈliːs/', partOfSpeech: 'v./n.', definition: '释放；发布；发行', example: 'The new movie will be released next month.' },
    { word: 'relevant', phonetic: '/ˈreləvənt/', partOfSpeech: 'adj.', definition: '相关的；切题的', example: 'Make sure your comments are relevant to the topic.' },
    { word: 'reluctant', phonetic: '/rɪˈlʌktənt/', partOfSpeech: 'adj.', definition: '不情愿的；勉强的', example: 'He was reluctant to admit his mistake.' },
    { word: 'rely', phonetic: '/rɪˈlaɪ/', partOfSpeech: 'v.', definition: '依赖；信赖', example: 'We rely on public transportation.' },
    { word: 'remain', phonetic: '/rɪˈmeɪn/', partOfSpeech: 'v.', definition: '保持；留下', example: 'The problem remains unsolved.' },
    { word: 'remark', phonetic: '/rɪˈmɑːk/', partOfSpeech: 'v./n.', definition: '评论；提及', example: 'She made a clever remark.' },
    { word: 'remedy', phonetic: '/ˈremədi/', partOfSpeech: 'n./v.', definition: '补救；治疗', example: 'There is no simple remedy for the problem.' },
    { word: 'remote', phonetic: '/rɪˈməʊt/', partOfSpeech: 'adj.', definition: '偏僻的；遥远的；远程的', example: 'The village is remote and hard to reach.' },
    { word: 'remove', phonetic: '/rɪˈmuːv/', partOfSpeech: 'v.', definition: '移除；去掉', example: 'Please remove your shoes before entering.' },
    { word: 'renew', phonetic: '/rɪˈnjuː/', partOfSpeech: 'v.', definition: '更新；续约', example: 'I need to renew my passport.' },
    { word: 'replace', phonetic: '/rɪˈpleɪs/', partOfSpeech: 'v.', definition: '替换；代替', example: 'Robots are replacing humans in some factories.' },
    { word: 'represent', phonetic: '/ˌreprɪˈzent/', partOfSpeech: 'v.', definition: '代表；表示', example: 'The red line represents the border.' },
    { word: 'reputation', phonetic: '/ˌrepjuˈteɪʃn/', partOfSpeech: 'n.', definition: '名誉；声誉', example: 'The company has a good reputation.' },
    { word: 'request', phonetic: '/rɪˈkwest/', partOfSpeech: 'n./v.', definition: '请求；要求', example: 'We received a request for more information.' },
    { word: 'require', phonetic: '/rɪˈkwaɪə/', partOfSpeech: 'v.', definition: '需要；要求', example: 'The job requires a lot of patience.' },
    { word: 'resemble', phonetic: '/rɪˈzembl/', partOfSpeech: 'v.', definition: '类似；相像', example: 'She resembles her mother in many ways.' },
    { word: 'reserve', phonetic: '/rɪˈzɜːv/', partOfSpeech: 'v./n.', definition: '保留；预订', example: 'Please reserve a table for two.' },
    { word: 'reside', phonetic: '/rɪˈzaɪd/', partOfSpeech: 'v.', definition: '居住；存在', example: 'The family resides in a small town.' },
    { word: 'resign', phonetic: '/rɪˈzaɪn/', partOfSpeech: 'v.', definition: '辞职；放弃', example: 'She resigned from her position as director.' },
    { word: 'resistance', phonetic: '/rɪˈzɪstəns/', partOfSpeech: 'n.', definition: '抵抗；阻力；免疫力', example: 'The patient developed resistance to the drug.' },
    { word: 'resolution', phonetic: '/ˌrezəˈluːʃn/', partOfSpeech: 'n.', definition: '决议；决心；分辨率', example: 'The committee passed a resolution.' },
    { word: 'resolve', phonetic: '/rɪˈzɒlv/', partOfSpeech: 'v./n.', definition: '解决；决心', example: 'We need to resolve this conflict.' },
    { word: 'resource', phonetic: '/rɪˈzɔːs/', partOfSpeech: 'n.', definition: '资源', example: 'The country has abundant natural resources.' },
    { word: 'respond', phonetic: '/rɪˈspɒnd/', partOfSpeech: 'v.', definition: '回应；反应', example: 'She responded to the question quickly.' },
    { word: 'restore', phonetic: '/rɪˈstɔː/', partOfSpeech: 'v.', definition: '恢复；修复', example: 'The building was restored to its original condition.' },
    { word: 'restrict', phonetic: '/rɪˈstrɪkt/', partOfSpeech: 'v.', definition: '限制；约束', example: 'Access to the site is restricted.' },
    { word: 'retain', phonetic: '/rɪˈteɪn/', partOfSpeech: 'v.', definition: '保留；保持', example: 'The company retained its top talent.' },
    { word: 'reveal', phonetic: '/rɪˈviːl/', partOfSpeech: 'v.', definition: '揭示；揭露', example: 'The investigation revealed a shocking truth.' },
    { word: 'revenue', phonetic: '/ˈrevənjuː/', partOfSpeech: 'n.', definition: '收入；税收', example: 'The company\'s revenue increased by 20%.' },
    { word: 'reverse', phonetic: '/rɪˈvɜːs/', partOfSpeech: 'v./adj./n.', definition: '逆转；颠倒', example: 'The decision was reversed on appeal.' },
    { word: 'revise', phonetic: '/rɪˈvaɪz/', partOfSpeech: 'v.', definition: '修订；修改；复习', example: 'You should revise your essay before submitting it.' },
    { word: 'revolution', phonetic: '/ˌrevəˈluːʃn/', partOfSpeech: 'n.', definition: '革命；变革', example: 'The industrial revolution changed society.' },
    { word: 'risk', phonetic: '/rɪsk/', partOfSpeech: 'n./v.', definition: '风险；危险', example: 'Smoking increases the risk of lung cancer.' },
    { word: 'rival', phonetic: '/ˈraɪvl/', partOfSpeech: 'n./adj./v.', definition: '对手；竞争的', example: 'The two companies are fierce rivals.' },
    { word: 'route', phonetic: '/ruːt/', partOfSpeech: 'n./v.', definition: '路线；路径', example: 'What is the best route to the airport?' },
    { word: 'satisfy', phonetic: '/ˈsætɪsfaɪ/', partOfSpeech: 'v.', definition: '满足；使满意', example: 'The product satisfies customer needs.' },
    { word: 'scale', phonetic: '/skeɪl/', partOfSpeech: 'n./v.', definition: '规模；刻度；攀登', example: 'The project was carried out on a large scale.' },
    { word: 'schedule', phonetic: '/ˈʃedjuːl/', partOfSpeech: 'n./v.', definition: '时间表；日程', example: 'The flight is scheduled to depart at 6 pm.' },
    { word: 'scheme', phonetic: '/skiːm/', partOfSpeech: 'n./v.', definition: '方案；计划；体系', example: 'The government launched a new pension scheme.' },
    { word: 'section', phonetic: '/ˈsekʃn/', partOfSpeech: 'n.', definition: '部分；区域；章节', example: 'Read section 3 of the document.' },
    { word: 'sector', phonetic: '/ˈsektə/', partOfSpeech: 'n.', definition: '部门；领域；行业', example: 'The technology sector is growing rapidly.' },
    { word: 'secure', phonetic: '/sɪˈkjʊə/', partOfSpeech: 'adj./v.', definition: '安全的；获得；保护', example: 'We need to secure the building.' },
    { word: 'seek', phonetic: '/siːk/', partOfSpeech: 'v.', definition: '寻求；寻找', example: 'You should seek professional advice.' },
    { word: 'segment', phonetic: '/ˈseɡmənt/', partOfSpeech: 'n./v.', definition: '部分；片段；分割', example: 'The company targets a specific market segment.' },
    { word: 'select', phonetic: '/sɪˈlekt/', partOfSpeech: 'v./adj.', definition: '选择；挑选', example: 'Please select your preferred option.' },
    { word: 'sequence', phonetic: '/ˈsiːkwəns/', partOfSpeech: 'n./v.', definition: '序列；顺序', example: 'The events occurred in a logical sequence.' },
    { word: 'series', phonetic: '/ˈsɪəriːz/', partOfSpeech: 'n.', definition: '系列；连续', example: 'A series of meetings will be held.' },
    { word: 'severe', phonetic: '/sɪˈvɪə/', partOfSpeech: 'adj.', definition: '严重的；剧烈的', example: 'The storm caused severe damage.' },
    { word: 'shift', phonetic: '/ʃɪft/', partOfSpeech: 'v./n.', definition: '转移；转变；轮班', example: 'Public opinion has shifted dramatically.' },
    { word: 'significant', phonetic: '/sɪɡˈnɪfɪkənt/', partOfSpeech: 'adj.', definition: '重要的；显著的', example: 'There has been a significant improvement.' },
    { word: 'similar', phonetic: '/ˈsɪmələ/', partOfSpeech: 'adj.', definition: '相似的；类似的', example: 'The two products are very similar.' },
    { word: 'simulate', phonetic: '/ˈsɪmjuleɪt/', partOfSpeech: 'v.', definition: '模拟；模仿', example: 'The software simulates real driving conditions.' },
    { word: 'sophisticated', phonetic: '/səˈfɪstɪkeɪtɪd/', partOfSpeech: 'adj.', definition: '复杂的；精密的', example: 'The system uses sophisticated technology.' },
    { word: 'source', phonetic: '/sɔːs/', partOfSpeech: 'n.', definition: '来源；源头', example: 'The journalist refused to reveal her source.' },
    { word: 'specific', phonetic: '/spəˈsɪfɪk/', partOfSpeech: 'adj.', definition: '具体的；特定的', example: 'Please be more specific about your requirements.' },
    { word: 'sponsor', phonetic: '/ˈspɒnsə/', partOfSpeech: 'n./v.', definition: '赞助者；赞助', example: 'The event was sponsored by a major bank.' },
    { word: 'stable', phonetic: '/ˈsteɪbl/', partOfSpeech: 'adj./n.', definition: '稳定的；马厩', example: 'The patient\'s condition is stable.' },
    { word: 'standard', phonetic: '/ˈstændəd/', partOfSpeech: 'n./adj.', definition: '标准；水准', example: 'The work meets industry standards.' },
    { word: 'statistics', phonetic: '/stəˈtɪstɪks/', partOfSpeech: 'n.', definition: '统计；统计数据', example: 'The statistics show a clear trend.' },
    { word: 'status', phonetic: '/ˈsteɪtəs/', partOfSpeech: 'n.', definition: '地位；状态；身份', example: 'What is the current status of the project?' },
    { word: 'strategic', phonetic: '/strəˈtiːdʒɪk/', partOfSpeech: 'adj.', definition: '战略的；策略性的', example: 'We need a strategic plan for growth.' },
    { word: 'stress', phonetic: '/stres/', partOfSpeech: 'n./v.', definition: '压力；强调', example: 'Yoga helps to relieve stress.' },
    { word: 'structure', phonetic: '/ˈstrʌktʃə/', partOfSpeech: 'n./v.', definition: '结构；构造；组织', example: 'The essay has a clear structure.' },
    { word: 'struggle', phonetic: '/ˈstrʌɡl/', partOfSpeech: 'v./n.', definition: '奋斗；挣扎；斗争', example: 'Many families struggle to make ends meet.' },
    { word: 'submit', phonetic: '/səbˈmɪt/', partOfSpeech: 'v.', definition: '提交；呈递；服从', example: 'Please submit your application by Friday.' },
    { word: 'subsequent', phonetic: '/ˈsʌbsɪkwənt/', partOfSpeech: 'adj.', definition: '随后的', example: 'Subsequent events proved her right.' },
    { word: 'subsidy', phonetic: '/ˈsʌbsədi/', partOfSpeech: 'n.', definition: '补贴；津贴', example: 'The government provides subsidies for renewable energy.' },
    { word: 'substance', phonetic: '/ˈsʌbstəns/', partOfSpeech: 'n.', definition: '物质；实质；内容', example: 'The substance of the argument is valid.' },
    { word: 'substantial', phonetic: '/səbˈstænʃl/', partOfSpeech: 'adj.', definition: '大量的；实质的', example: 'We need to make substantial changes.' },
    { word: 'substitute', phonetic: '/ˈsʌbstɪtjuːt/', partOfSpeech: 'n./v.', definition: '替代品；替代', example: 'You can substitute honey for sugar.' },
    { word: 'succeed', phonetic: '/səkˈsiːd/', partOfSpeech: 'v.', definition: '成功；继承', example: 'She succeeded in passing the exam.' },
    { word: 'sufficient', phonetic: '/səˈfɪʃnt/', partOfSpeech: 'adj.', definition: '足够的；充分的', example: 'The evidence is not sufficient to prove guilt.' },
    { word: 'summarize', phonetic: '/ˈsʌməraɪz/', partOfSpeech: 'v.', definition: '总结；概述', example: 'Can you summarize the main points?' },
    { word: 'superior', phonetic: '/suːˈpɪəriə/', partOfSpeech: 'adj./n.', definition: '优越的；上司', example: 'This product is superior to its competitors.' },
    { word: 'supplement', phonetic: '/ˈsʌplɪmənt/', partOfSpeech: 'n./v.', definition: '补充；增补', example: 'She takes vitamin supplements.' },
    { word: 'supply', phonetic: '/səˈplaɪ/', partOfSpeech: 'v./n.', definition: '供应；提供', example: 'The city\'s water supply was cut off.' },
    { word: 'support', phonetic: '/səˈpɔːt/', partOfSpeech: 'v./n.', definition: '支持；支援', example: 'The data supports this conclusion.' },
    { word: 'suppose', phonetic: '/səˈpəʊz/', partOfSpeech: 'v.', definition: '假设；假定', example: 'I suppose you are right.' },
    { word: 'suppress', phonetic: '/səˈpres/', partOfSpeech: 'v.', definition: '压制；抑制', example: 'She tried to suppress her anger.' },
    { word: 'surface', phonetic: '/ˈsɜːfɪs/', partOfSpeech: 'n./v.', definition: '表面；水面；浮出水面', example: 'The submarine surfaced after three days.' },
    { word: 'surplus', phonetic: '/ˈsɜːpləs/', partOfSpeech: 'n./adj.', definition: '盈余；过剩', example: 'The country has a trade surplus.' },
    { word: 'surrender', phonetic: '/səˈrendə/', partOfSpeech: 'v./n.', definition: '投降；放弃', example: 'The rebels surrendered to the authorities.' },
    { word: 'surround', phonetic: '/səˈraʊnd/', partOfSpeech: 'v.', definition: '包围；环绕', example: 'The house is surrounded by beautiful gardens.' },
    { word: 'survey', phonetic: '/ˈsɜːveɪ/', partOfSpeech: 'n./v.', definition: '调查；测量', example: 'A survey found that 80% of people support the plan.' },
    { word: 'survive', phonetic: '/səˈvaɪv/', partOfSpeech: 'v.', definition: '幸存；存活', example: 'Only a few passengers survived the crash.' },
    { word: 'suspect', phonetic: '/səˈspekt/', partOfSpeech: 'v./n./adj.', definition: '怀疑；嫌疑人；可疑的', example: 'The police suspect he is lying.' },
    { word: 'suspend', phonetic: '/səˈspend/', partOfSpeech: 'v.', definition: '暂停；悬挂', example: 'The project was suspended due to lack of funds.' },
    { word: 'sustain', phonetic: '/səˈsteɪn/', partOfSpeech: 'v.', definition: '维持；支撑', example: 'The ecosystem can sustain only a limited population.' },
    { word: 'symbol', phonetic: '/ˈsɪmbl/', partOfSpeech: 'n.', definition: '符号；象征', example: 'The dove is a symbol of peace.' },
    { word: 'sympathy', phonetic: '/ˈsɪmpəθi/', partOfSpeech: 'n.', definition: '同情；同情心', example: 'I have no sympathy for his actions.' },
    { word: 'tackle', phonetic: '/ˈtækl/', partOfSpeech: 'v./n.', definition: '处理；应对；用具', example: 'The government must tackle the problem of unemployment.' },
    { word: 'target', phonetic: '/ˈtɑːɡɪt/', partOfSpeech: 'n./v.', definition: '目标；对象', example: 'We need to set clear targets.' },
    { word: 'technique', phonetic: '/tekˈniːk/', partOfSpeech: 'n.', definition: '技术；技巧', example: 'The artist uses a unique technique.' },
    { word: 'technology', phonetic: '/tekˈnɒlədʒi/', partOfSpeech: 'n.', definition: '技术；科技', example: 'Modern technology has changed our lives.' },
    { word: 'temporary', phonetic: '/ˈtemprəri/', partOfSpeech: 'adj.', definition: '临时的；暂时的', example: 'She found a temporary job.' },
    { word: 'tendency', phonetic: '/ˈtendənsi/', partOfSpeech: 'n.', definition: '趋势；倾向', example: 'There is a growing tendency to work from home.' },
    { word: 'territory', phonetic: '/ˈterətri/', partOfSpeech: 'n.', definition: '领土；领域；地盘', example: 'The island is disputed territory.' },
    { word: 'theory', phonetic: '/ˈθɪəri/', partOfSpeech: 'n.', definition: '理论；学说', example: 'Einstein\'s theory of relativity changed physics.' },
    { word: 'therapy', phonetic: '/ˈθerəpi/', partOfSpeech: 'n.', definition: '治疗；疗法', example: 'He is undergoing physical therapy.' },
    { word: 'thorough', phonetic: '/ˈθʌrə/', partOfSpeech: 'adj.', definition: '彻底的；全面的', example: 'The police conducted a thorough investigation.' },
    { word: 'threat', phonetic: '/θret/', partOfSpeech: 'n.', definition: '威胁；恐吓', example: 'Pollution poses a serious threat to wildlife.' },
    { word: 'tolerate', phonetic: '/ˈtɒləreɪt/', partOfSpeech: 'v.', definition: '容忍；忍受', example: 'The body cannot tolerate extreme temperatures.' },
    { word: 'trace', phonetic: '/treɪs/', partOfSpeech: 'v./n.', definition: '追踪；追溯；痕迹', example: 'The police traced the call to a mobile phone.' },
    { word: 'tradition', phonetic: '/trəˈdɪʃn/', partOfSpeech: 'n.', definition: '传统；惯例', example: 'It is a tradition to exchange gifts at Christmas.' },
    { word: 'transfer', phonetic: '/trænsˈfɜː/', partOfSpeech: 'v./n.', definition: '转移；调动；转乘', example: 'She transferred to a new department.' },
    { word: 'transform', phonetic: '/trænsˈfɔːm/', partOfSpeech: 'v.', definition: '改变；转变；改造', example: 'The city has been transformed in recent years.' },
    { word: 'transition', phonetic: '/trænˈzɪʃn/', partOfSpeech: 'n./v.', definition: '过渡；转变', example: 'The transition to renewable energy will take time.' },
    { word: 'transmit', phonetic: '/trænzˈmɪt/', partOfSpeech: 'v.', definition: '传输；传播；传染', example: 'The disease is transmitted through mosquito bites.' },
    { word: 'transparent', phonetic: '/trænsˈpærənt/', partOfSpeech: 'adj.', definition: '透明的；坦率的', example: 'The company should be transparent about its policies.' },
    { word: 'transport', phonetic: '/ˈtrænspɔːt/', partOfSpeech: 'n./v.', definition: '运输；交通', example: 'Public transport is efficient in this city.' },
    { word: 'trend', phonetic: '/trend/', partOfSpeech: 'n./v.', definition: '趋势；潮流', example: 'There is a growing trend towards remote work.' },
    { word: 'trigger', phonetic: '/ˈtrɪɡə/', partOfSpeech: 'v./n.', definition: '触发；引发；扳机', example: 'The alarm is triggered by motion.' },
    { word: 'typical', phonetic: '/ˈtɪpɪkl/', partOfSpeech: 'adj.', definition: '典型的', example: 'This is a typical example of Baroque architecture.' },
    { word: 'ultimate', phonetic: '/ˈʌltɪmət/', partOfSpeech: 'adj./n.', definition: '最终的；极端的', example: 'The ultimate goal is world peace.' },
    { word: 'undergo', phonetic: '/ˌʌndəˈɡəʊ/', partOfSpeech: 'v.', definition: '经历；经受', example: 'The patient underwent surgery.' },
    { word: 'undermine', phonetic: '/ˌʌndəˈmaɪn/', partOfSpeech: 'v.', definition: '削弱；破坏', example: 'The scandal undermined public trust.' },
    { word: 'undertake', phonetic: '/ˌʌndəˈteɪk/', partOfSpeech: 'v.', definition: '承担；从事', example: 'The university undertook a major research project.' },
    { word: 'unemployment', phonetic: '/ˌʌnɪmˈplɔɪmənt/', partOfSpeech: 'n.', definition: '失业', example: 'Unemployment rates have fallen.' },
    { word: 'unique', phonetic: '/juˈniːk/', partOfSpeech: 'adj.', definition: '独特的；唯一的', example: 'Each fingerprint is unique.' },
    { word: 'universal', phonetic: '/ˌjuːnɪˈvɜːsl/', partOfSpeech: 'adj.', definition: '普遍的；全世界的', example: 'Education is a universal human right.' },
    { word: 'update', phonetic: '/ˌʌpˈdeɪt/', partOfSpeech: 'v./n.', definition: '更新；升级', example: 'Please update your software regularly.' },
    { word: 'upgrade', phonetic: '/ˌʌpˈɡreɪd/', partOfSpeech: 'v./n.', definition: '升级；提升', example: 'The system was upgraded to improve performance.' },
    { word: 'urban', phonetic: '/ˈɜːbən/', partOfSpeech: 'adj.', definition: '城市的；都市的', example: 'Urban areas are becoming increasingly crowded.' },
    { word: 'utilize', phonetic: '/ˈjuːtəlaɪz/', partOfSpeech: 'v.', definition: '利用；使用', example: 'We need to utilize our resources more efficiently.' },
    { word: 'valid', phonetic: '/ˈvælɪd/', partOfSpeech: 'adj.', definition: '有效的；合理的', example: 'Your passport must be valid for at least six months.' },
    { word: 'value', phonetic: '/ˈvæljuː/', partOfSpeech: 'n./v.', definition: '价值；珍视', example: 'The property has increased in value.' },
    { word: 'variation', phonetic: '/ˌveəriˈeɪʃn/', partOfSpeech: 'n.', definition: '变化；变异', example: 'There is wide variation in prices.' },
    { word: 'variety', phonetic: '/vəˈraɪəti/', partOfSpeech: 'n.', definition: '多样性；种类', example: 'The store offers a variety of products.' },
    { word: 'venture', phonetic: '/ˈventʃə/', partOfSpeech: 'n./v.', definition: '企业；风险项目；冒险', example: 'The business venture was successful.' },
    { word: 'verify', phonetic: '/ˈverɪfaɪ/', partOfSpeech: 'v.', definition: '验证；核实', example: 'We need to verify your identity.' },
    { word: 'version', phonetic: '/ˈvɜːʃn/', partOfSpeech: 'n.', definition: '版本；说法', example: 'The latest version includes new features.' },
    { word: 'via', phonetic: '/ˈvaɪə/', partOfSpeech: 'prep.', definition: '通过；经由', example: 'We traveled to Paris via London.' },
    { word: 'victim', phonetic: '/ˈvɪktɪm/', partOfSpeech: 'n.', definition: '受害者；牺牲品', example: 'The victims of the disaster received compensation.' },
    { word: 'violate', phonetic: '/ˈvaɪəleɪt/', partOfSpeech: 'v.', definition: '违反；侵犯', example: 'The company violated safety regulations.' },
    { word: 'virtual', phonetic: '/ˈvɜːtʃuəl/', partOfSpeech: 'adj.', definition: '虚拟的；实质上的', example: 'Virtual reality is becoming more popular.' },
    { word: 'visible', phonetic: '/ˈvɪzəbl/', partOfSpeech: 'adj.', definition: '可见的；明显的', example: 'The stain is not visible to the naked eye.' },
    { word: 'vision', phonetic: '/ˈvɪʒn/', partOfSpeech: 'n.', definition: '愿景；视力；远见', example: 'She had a clear vision for the company.' },
    { word: 'visual', phonetic: '/ˈvɪʒuəl/', partOfSpeech: 'adj.', definition: '视觉的；直观的', example: 'The presentation included many visual aids.' },
    { word: 'vital', phonetic: '/ˈvaɪtl/', partOfSpeech: 'adj.', definition: '至关重要的', example: 'Regular exercise is vital for good health.' },
    { word: 'volume', phonetic: '/ˈvɒljuːm/', partOfSpeech: 'n.', definition: '量；体积；音量', example: 'The volume of sales increased dramatically.' },
    { word: 'voluntary', phonetic: '/ˈvɒləntri/', partOfSpeech: 'adj.', definition: '自愿的；志愿的', example: 'The work is done on a voluntary basis.' },
    { word: 'vulnerable', phonetic: '/ˈvʌlnərəbl/', partOfSpeech: 'adj.', definition: '脆弱的；易受伤害的', example: 'Children are the most vulnerable members of society.' },
    { word: 'welfare', phonetic: '/ˈwelfeə/', partOfSpeech: 'n.', definition: '福利；幸福', example: 'The government provides welfare for the needy.' },
    { word: 'widespread', phonetic: '/ˈwaɪdspred/', partOfSpeech: 'adj.', definition: '广泛的；普遍的', example: 'The disease is widespread in rural areas.' },
    { word: 'willing', phonetic: '/ˈwɪlɪŋ/', partOfSpeech: 'adj.', definition: '愿意的；乐意的', example: 'Are you willing to help?' },
    { word: 'withdraw', phonetic: '/wɪðˈdrɔː/', partOfSpeech: 'v.', definition: '撤回；退出；提取', example: 'She withdrew money from the bank.' },
    { word: 'witness', phonetic: '/ˈwɪtnəs/', partOfSpeech: 'n./v.', definition: '目击者；证人；见证', example: 'Several witnesses saw the accident.' },
    { word: 'workforce', phonetic: '/ˈwɜːkfɔːs/', partOfSpeech: 'n.', definition: '劳动力', example: 'A skilled workforce is essential for economic growth.' },
    { word: 'yield', phonetic: '/jiːld/', partOfSpeech: 'v./n.', definition: '产出；屈服；收益', example: 'The investment yielded a high return.' },
    { word: 'zone', phonetic: '/zəʊn/', partOfSpeech: 'n./v.', definition: '区域；地带；分区', example: 'The city is divided into different zones.' },
  ]
}

function getThemeWords(theme: string): VocabEntry[] {
  if (theme === 'kitchen') {
    return [
      // ===== Cookware =====
      { word: 'pot', partOfSpeech: 'n.', definition: 'n. 锅；罐；壶' },
      { word: 'pan', partOfSpeech: 'n.', definition: 'n. 平底锅' },
      { word: 'frying pan', partOfSpeech: 'n.', definition: 'n. 煎锅；平底锅' },
      { word: 'saucepan', partOfSpeech: 'n.', definition: 'n. 炖锅；深平底锅' },
      { word: 'wok', partOfSpeech: 'n.', definition: 'n. 炒锅；镬' },
      { word: 'lid', partOfSpeech: 'n.', definition: 'n. 盖子；锅盖' },
      { word: 'oven', partOfSpeech: 'n.', definition: 'n. 烤箱；烤炉' },
      { word: 'microwave', partOfSpeech: 'n.', definition: 'n. 微波炉' },
      { word: 'toaster', partOfSpeech: 'n.', definition: 'n. 烤面包机' },
      { word: 'kettle', partOfSpeech: 'n.', definition: 'n. 烧水壶；水壶' },
      { word: 'steamer', partOfSpeech: 'n.', definition: 'n. 蒸锅；蒸笼' },
      { word: 'grill', partOfSpeech: 'n.', definition: 'n. 烤架；烧烤架' },
      { word: 'rice cooker', partOfSpeech: 'n.', definition: 'n. 电饭煲；电饭锅' },
      { word: 'pressure cooker', partOfSpeech: 'n.', definition: 'n. 压力锅；高压锅' },
      // ===== Utensils =====
      { word: 'knife', partOfSpeech: 'n.', definition: 'n. 刀；菜刀' },
      { word: 'spatula', partOfSpeech: 'n.', definition: 'n. 锅铲；刮刀' },
      { word: 'ladle', partOfSpeech: 'n.', definition: 'n. 汤勺；大勺' },
      { word: 'whisk', partOfSpeech: 'n.', definition: 'n. 打蛋器；搅拌器' },
      { word: 'tongs', partOfSpeech: 'n.', definition: 'n. 夹子；钳子（复数）' },
      { word: 'peeler', partOfSpeech: 'n.', definition: 'n. 削皮器' },
      { word: 'grater', partOfSpeech: 'n.', definition: 'n. 刨丝器；磨碎器' },
      { word: 'colander', partOfSpeech: 'n.', definition: 'n. 漏勺；滤盆' },
      { word: 'rolling pin', partOfSpeech: 'n.', definition: 'n. 擀面杖' },
      { word: 'cutting board', partOfSpeech: 'n.', definition: 'n. 砧板；切菜板' },
      { word: 'measuring cup', partOfSpeech: 'n.', definition: 'n. 量杯' },
      { word: 'can opener', partOfSpeech: 'n.', definition: 'n. 开罐器' },
      { word: 'garlic press', partOfSpeech: 'n.', definition: 'n. 压蒜器' },
      // ===== Tableware =====
      { word: 'plate', partOfSpeech: 'n.', definition: 'n. 盘子；碟子' },
      { word: 'bowl', partOfSpeech: 'n.', definition: 'n. 碗' },
      { word: 'cup', partOfSpeech: 'n.', definition: 'n. 杯子' },
      { word: 'mug', partOfSpeech: 'n.', definition: 'n. 马克杯' },
      { word: 'glass', partOfSpeech: 'n.', definition: 'n. 玻璃杯' },
      { word: 'fork', partOfSpeech: 'n.', definition: 'n. 叉子' },
      { word: 'spoon', partOfSpeech: 'n.', definition: 'n. 勺子' },
      { word: 'chopsticks', partOfSpeech: 'n.', definition: 'n. 筷子（复数）' },
      { word: 'napkin', partOfSpeech: 'n.', definition: 'n. 餐巾' },
      { word: 'teapot', partOfSpeech: 'n.', definition: 'n. 茶壶' },
      // ===== Appliances =====
      { word: 'refrigerator', partOfSpeech: 'n.', definition: 'n. 冰箱' },
      { word: 'freezer', partOfSpeech: 'n.', definition: 'n. 冰柜；冷冻室' },
      { word: 'dishwasher', partOfSpeech: 'n.', definition: 'n. 洗碗机' },
      { word: 'blender', partOfSpeech: 'n.', definition: 'n. 搅拌机' },
      { word: 'coffee maker', partOfSpeech: 'n.', definition: 'n. 咖啡机' },
      { word: 'induction cooker', partOfSpeech: 'n.', definition: 'n. 电磁炉' },
      { word: 'exhaust hood', partOfSpeech: 'n.', definition: 'n. 抽油烟机' },
      // ===== Food & Ingredients =====
      { word: 'ingredient', partOfSpeech: 'n.', definition: 'n. 食材；原料' },
      { word: 'seasoning', partOfSpeech: 'n.', definition: 'n. 调味料；佐料' },
      { word: 'condiment', partOfSpeech: 'n.', definition: 'n. 调味品；酱料' },
      { word: 'salt', partOfSpeech: 'n.', definition: 'n. 盐' },
      { word: 'pepper', partOfSpeech: 'n.', definition: 'n. 胡椒；胡椒粉' },
      { word: 'soy sauce', partOfSpeech: 'n.', definition: 'n. 酱油' },
      { word: 'vinegar', partOfSpeech: 'n.', definition: 'n. 醋' },
      { word: 'cooking oil', partOfSpeech: 'n.', definition: 'n. 食用油' },
      { word: 'flour', partOfSpeech: 'n.', definition: 'n. 面粉' },
      { word: 'butter', partOfSpeech: 'n.', definition: 'n. 黄油；牛油' },
      { word: 'cheese', partOfSpeech: 'n.', definition: 'n. 奶酪；芝士' },
      { word: 'garlic', partOfSpeech: 'n.', definition: 'n. 大蒜' },
      { word: 'ginger', partOfSpeech: 'n.', definition: 'n. 姜' },
      // ===== Cooking Actions =====
      { word: 'boil', partOfSpeech: 'v.', definition: 'v. 煮；煮沸' },
      { word: 'fry', partOfSpeech: 'v.', definition: 'v. 油炸；油煎' },
      { word: 'stir-fry', partOfSpeech: 'v.', definition: 'v. 炒；翻炒' },
      { word: 'steam', partOfSpeech: 'v.', definition: 'v. 蒸' },
      { word: 'bake', partOfSpeech: 'v.', definition: 'v. 烤（面包糕点类）' },
      { word: 'roast', partOfSpeech: 'v.', definition: 'v. 烤（肉类蔬菜类）' },
      { word: 'simmer', partOfSpeech: 'v.', definition: 'v. 慢煮；煨；炖' },
      { word: 'stew', partOfSpeech: 'v.', definition: 'v. 炖；焖' },
      { word: 'marinate', partOfSpeech: 'v.', definition: 'v. 腌制；浸泡（调料）' },
      { word: 'chop', partOfSpeech: 'v.', definition: 'v. 切碎；剁' },
      { word: 'dice', partOfSpeech: 'v.', definition: 'v. 切丁；切成小方块' },
      { word: 'slice', partOfSpeech: 'v.', definition: 'v. 切片；切成薄片' },
      { word: 'peel', partOfSpeech: 'v.', definition: 'v. 削皮；剥皮' },
      { word: 'knead', partOfSpeech: 'v.', definition: 'v. 揉面；揉搓' },
      { word: 'drain', partOfSpeech: 'v.', definition: 'v. 沥干；排掉' },
      { word: 'rinse', partOfSpeech: 'v.', definition: 'v. 冲洗；漂洗' },
      { word: 'season', partOfSpeech: 'v.', definition: 'v. 给…调味' },
      { word: 'sprinkle', partOfSpeech: 'v.', definition: 'v. 撒；洒' },
      { word: 'stir', partOfSpeech: 'v.', definition: 'v. 搅拌；搅动' },
      // ===== Descriptive =====
      { word: 'fresh', partOfSpeech: 'adj.', definition: 'adj. 新鲜的' },
      { word: 'frozen', partOfSpeech: 'adj.', definition: 'adj. 冷冻的；结冰的' },
      { word: 'raw', partOfSpeech: 'adj.', definition: 'adj. 生的；未煮熟的' },
      { word: 'tender', partOfSpeech: 'adj.', definition: 'adj. 嫩的；柔软的' },
      { word: 'crispy', partOfSpeech: 'adj.', definition: 'adj. 酥脆的；松脆的' },
      { word: 'juicy', partOfSpeech: 'adj.', definition: 'adj. 多汁的' },
      { word: 'greasy', partOfSpeech: 'adj.', definition: 'adj. 油腻的' },
      { word: 'spicy', partOfSpeech: 'adj.', definition: 'adj. 辣的；辛辣的' },
      { word: 'bland', partOfSpeech: 'adj.', definition: 'adj. （食物）清淡的；无味的' },
      { word: 'savory', partOfSpeech: 'adj.', definition: 'adj. 咸味的；美味的（非甜）' },
      // ===== Kitchen fixtures =====
      { word: 'counter', partOfSpeech: 'n.', definition: 'n. 料理台；吧台' },
      { word: 'sink', partOfSpeech: 'n.', definition: 'n. 水槽；洗碗池' },
      { word: 'faucet', partOfSpeech: 'n.', definition: 'n. 水龙头' },
      { word: 'cabinet', partOfSpeech: 'n.', definition: 'n. 橱柜；储藏柜' },
      { word: 'drawer', partOfSpeech: 'n.', definition: 'n. 抽屉' },
      { word: 'pantry', partOfSpeech: 'n.', definition: 'n. 食品储藏室' },
      { word: 'trash can', partOfSpeech: 'n.', definition: 'n. 垃圾桶' },
      { word: 'apron', partOfSpeech: 'n.', definition: 'n. 围裙' },
      { word: 'dish rack', partOfSpeech: 'n.', definition: 'n. 碗架；晾碗架' },
      { word: 'sponge', partOfSpeech: 'n.', definition: 'n. 海绵；洗碗布' },
      { word: 'dish soap', partOfSpeech: 'n.', definition: 'n. 洗洁精；洗碗液' },
    ]
  } else if (theme === 'car') {
    return [
      // ===== Car Parts =====
      { word: 'steering wheel', partOfSpeech: 'n.', definition: 'n. 方向盘' },
      { word: 'seat belt', partOfSpeech: 'n.', definition: 'n. 安全带' },
      { word: 'rearview mirror', partOfSpeech: 'n.', definition: 'n. 后视镜' },
      { word: 'windshield', partOfSpeech: 'n.', definition: 'n. 挡风玻璃' },
      { word: 'headlight', partOfSpeech: 'n.', definition: 'n. 前灯；头灯' },
      { word: 'taillight', partOfSpeech: 'n.', definition: 'n. 尾灯' },
      { word: 'turn signal', partOfSpeech: 'n.', definition: 'n. 转向灯' },
      { word: 'bumper', partOfSpeech: 'n.', definition: 'n. 保险杠' },
      { word: 'hood', partOfSpeech: 'n.', definition: 'n. 引擎盖' },
      { word: 'trunk', partOfSpeech: 'n.', definition: 'n. 后备箱' },
      { word: 'tire', partOfSpeech: 'n.', definition: 'n. 轮胎' },
      { word: 'brake', partOfSpeech: 'n./v.', definition: 'n. 刹车；v. 刹车' },
      { word: 'accelerator', partOfSpeech: 'n.', definition: 'n. 油门；加速器' },
      { word: 'clutch', partOfSpeech: 'n.', definition: 'n. 离合器' },
      { word: 'dashboard', partOfSpeech: 'n.', definition: 'n. 仪表盘' },
      { word: 'gas pedal', partOfSpeech: 'n.', definition: 'n. 油门踏板' },
      { word: 'license plate', partOfSpeech: 'n.', definition: 'n. 车牌' },
      { word: 'engine', partOfSpeech: 'n.', definition: 'n. 发动机；引擎' },
      { word: 'battery', partOfSpeech: 'n.', definition: 'n. 电池；电瓶' },
      { word: 'windshield wiper', partOfSpeech: 'n.', definition: 'n. 雨刮器' },
      { word: 'airbag', partOfSpeech: 'n.', definition: 'n. 安全气囊' },
      { word: 'gear shift', partOfSpeech: 'n.', definition: 'n. 变速杆；换挡杆' },
      { word: 'ignition', partOfSpeech: 'n.', definition: 'n. 点火装置' },
      { word: 'speedometer', partOfSpeech: 'n.', definition: 'n. 速度表' },
      // ===== Driving Actions =====
      { word: 'drive', partOfSpeech: 'v.', definition: 'v. 驾驶' },
      { word: 'park', partOfSpeech: 'v.', definition: 'v. 停车' },
      { word: 'reverse', partOfSpeech: 'v.', definition: 'v. 倒车' },
      { word: 'accelerate', partOfSpeech: 'v.', definition: 'v. 加速' },
      { word: 'decelerate', partOfSpeech: 'v.', definition: 'v. 减速' },
      { word: 'honk', partOfSpeech: 'v.', definition: 'v. 按喇叭' },
      { word: 'overtake', partOfSpeech: 'v.', definition: 'v. 超车' },
      { word: 'merge', partOfSpeech: 'v.', definition: 'v. 汇入（车流）' },
      // ===== Road & Driving Context =====
      { word: 'gas station', partOfSpeech: 'n.', definition: 'n. 加油站' },
      { word: 'parking lot', partOfSpeech: 'n.', definition: 'n. 停车场' },
      { word: 'traffic light', partOfSpeech: 'n.', definition: 'n. 红绿灯' },
      { word: 'speed limit', partOfSpeech: 'n.', definition: 'n. 限速' },
      { word: 'highway', partOfSpeech: 'n.', definition: 'n. 公路；高速公路' },
      { word: 'intersection', partOfSpeech: 'n.', definition: 'n. 十字路口' },
      { word: 'toll', partOfSpeech: 'n.', definition: 'n. 过路费；通行费' },
      { word: 'pedestrian', partOfSpeech: 'n.', definition: 'n. 行人' },
      { word: 'garage', partOfSpeech: 'n.', definition: 'n. 车库' },
      { word: 'navigation', partOfSpeech: 'n.', definition: 'n. 导航' },
      { word: "driver's license", partOfSpeech: 'n.', definition: 'n. 驾照' },
      // ===== Vehicle Types =====
      { word: 'sedan', partOfSpeech: 'n.', definition: 'n. 轿车' },
      { word: 'SUV', partOfSpeech: 'n.', definition: 'n. 运动型多用途车' },
      { word: 'truck', partOfSpeech: 'n.', definition: 'n. 卡车' },
      { word: 'van', partOfSpeech: 'n.', definition: 'n. 面包车' },
      { word: 'motorcycle', partOfSpeech: 'n.', definition: 'n. 摩托车' },
    ]
  } else if (theme === 'clothing') {
    return [
      // ===== Tops & Bottoms =====
      { word: 'shirt', partOfSpeech: 'n.', definition: 'n. 衬衫' },
      { word: 'T-shirt', partOfSpeech: 'n.', definition: 'n. T恤；短袖' },
      { word: 'blouse', partOfSpeech: 'n.', definition: 'n. 女士衬衫' },
      { word: 'sweater', partOfSpeech: 'n.', definition: 'n. 毛衣；卫衣' },
      { word: 'hoodie', partOfSpeech: 'n.', definition: 'n. 连帽衫' },
      { word: 'jacket', partOfSpeech: 'n.', definition: 'n. 夹克；外套' },
      { word: 'coat', partOfSpeech: 'n.', definition: 'n. 大衣；外套' },
      { word: 'vest', partOfSpeech: 'n.', definition: 'n. 马甲；背心' },
      { word: 'pants', partOfSpeech: 'n.', definition: 'n. 裤子' },
      { word: 'jeans', partOfSpeech: 'n.', definition: 'n. 牛仔裤' },
      { word: 'shorts', partOfSpeech: 'n.', definition: 'n. 短裤' },
      { word: 'skirt', partOfSpeech: 'n.', definition: 'n. 裙子' },
      { word: 'dress', partOfSpeech: 'n.', definition: 'n. 连衣裙' },
      // ===== Suits & Uniforms =====
      { word: 'suit', partOfSpeech: 'n.', definition: 'n. 西装' },
      { word: 'tie', partOfSpeech: 'n./v.', definition: 'n. 领带；v. 系' },
      { word: 'uniform', partOfSpeech: 'n.', definition: 'n. 制服' },
      // ===== Underwear & Sleepwear =====
      { word: 'underwear', partOfSpeech: 'n.', definition: 'n. 内衣' },
      { word: 'socks', partOfSpeech: 'n.', definition: 'n. 袜子（复数）' },
      { word: 'pajamas', partOfSpeech: 'n.', definition: 'n. 睡衣' },
      // ===== Footwear =====
      { word: 'shoes', partOfSpeech: 'n.', definition: 'n. 鞋（复数）' },
      { word: 'sneakers', partOfSpeech: 'n.', definition: 'n. 运动鞋' },
      { word: 'boots', partOfSpeech: 'n.', definition: 'n. 靴子（复数）' },
      { word: 'sandals', partOfSpeech: 'n.', definition: 'n. 凉鞋（复数）' },
      { word: 'slippers', partOfSpeech: 'n.', definition: 'n. 拖鞋（复数）' },
      // ===== Headwear & Accessories =====
      { word: 'hat', partOfSpeech: 'n.', definition: 'n. 帽子（有檐）' },
      { word: 'cap', partOfSpeech: 'n.', definition: 'n. 帽子（棒球帽类）' },
      { word: 'scarf', partOfSpeech: 'n.', definition: 'n. 围巾' },
      { word: 'belt', partOfSpeech: 'n.', definition: 'n. 皮带；腰带' },
      { word: 'wallet', partOfSpeech: 'n.', definition: 'n. 钱包' },
      { word: 'watch', partOfSpeech: 'n.', definition: 'n. 手表' },
      { word: 'umbrella', partOfSpeech: 'n.', definition: 'n. 雨伞' },
      // ===== Actions =====
      { word: 'wear', partOfSpeech: 'v.', definition: 'v. 穿；戴' },
      { word: 'get dressed', partOfSpeech: 'v.', definition: 'v. 穿衣服' },
      { word: 'undress', partOfSpeech: 'v.', definition: 'v. 脱衣服' },
      { word: 'button', partOfSpeech: 'v.', definition: 'v. 扣纽扣' },
      { word: 'zip', partOfSpeech: 'v.', definition: 'v. 拉上拉链' },
      { word: 'fold', partOfSpeech: 'v.', definition: 'v. 叠（衣服）' },
      { word: 'iron', partOfSpeech: 'v.', definition: 'v. 熨烫' },
      // ===== Materials & Features =====
      { word: 'cotton', partOfSpeech: 'n.', definition: 'n. 棉' },
      { word: 'wool', partOfSpeech: 'n.', definition: 'n. 羊毛' },
      { word: 'leather', partOfSpeech: 'n.', definition: 'n. 皮革' },
      { word: 'silk', partOfSpeech: 'n.', definition: 'n. 丝绸' },
      { word: 'denim', partOfSpeech: 'n.', definition: 'n. 牛仔布' },
      { word: 'pocket', partOfSpeech: 'n.', definition: 'n. 口袋' },
      { word: 'sleeve', partOfSpeech: 'n.', definition: 'n. 袖子' },
      { word: 'collar', partOfSpeech: 'n.', definition: 'n. 衣领' },
      { word: 'zipper', partOfSpeech: 'n.', definition: 'n. 拉链' },
      { word: 'laundry', partOfSpeech: 'n.', definition: 'n. 要洗的衣服；洗衣' },
      { word: 'hanger', partOfSpeech: 'n.', definition: 'n. 衣架' },
    ]
  } else if (theme === 'restaurant') {
    return [
      // ===== People & Roles =====
      { word: 'waiter', partOfSpeech: 'n.', definition: 'n. （男）服务员' },
      { word: 'waitress', partOfSpeech: 'n.', definition: 'n. （女）服务员' },
      { word: 'chef', partOfSpeech: 'n.', definition: 'n. 厨师；主厨' },
      { word: 'customer', partOfSpeech: 'n.', definition: 'n. 顾客' },
      { word: 'bartender', partOfSpeech: 'n.', definition: 'n. 调酒师；吧台服务员' },
      // ===== Menu & Food =====
      { word: 'menu', partOfSpeech: 'n.', definition: 'n. 菜单' },
      { word: 'appetizer', partOfSpeech: 'n.', definition: 'n. 开胃菜' },
      { word: 'main course', partOfSpeech: 'n.', definition: 'n. 主菜' },
      { word: 'side dish', partOfSpeech: 'n.', definition: 'n. 配菜；小菜' },
      { word: 'dessert', partOfSpeech: 'n.', definition: 'n. 甜品；甜点' },
      { word: 'beverage', partOfSpeech: 'n.', definition: 'n. 饮料' },
      { word: 'special', partOfSpeech: 'n.', definition: 'n. 特价菜；特色菜' },
      { word: 'combo', partOfSpeech: 'n.', definition: 'n. 套餐' },
      { word: 'buffet', partOfSpeech: 'n.', definition: 'n. 自助餐' },
      { word: 'takeout', partOfSpeech: 'n.', definition: 'n. 外卖' },
      { word: 'delivery', partOfSpeech: 'n.', definition: 'n. 外卖配送' },
      { word: 'leftovers', partOfSpeech: 'n.', definition: 'n. 剩菜（复数）' },
      // ===== Actions =====
      { word: 'order', partOfSpeech: 'v.', definition: 'v. 点餐' },
      { word: 'reserve', partOfSpeech: 'v.', definition: 'v. 预订' },
      { word: 'recommend', partOfSpeech: 'v.', definition: 'v. 推荐' },
      { word: 'serve', partOfSpeech: 'v.', definition: 'v. 上菜；服务' },
      { word: 'tip', partOfSpeech: 'v./n.', definition: 'v. 给小费；n. 小费' },
      { word: 'split', partOfSpeech: 'v.', definition: 'v. 分摊（账单）' },
      { word: 'refill', partOfSpeech: 'v./n.', definition: 'v. 续杯；n. 续杯' },
      // ===== Payment & Service =====
      { word: 'bill', partOfSpeech: 'n.', definition: 'n. 账单' },
      { word: 'receipt', partOfSpeech: 'n.', definition: 'n. 收据；小票' },
      { word: 'reservation', partOfSpeech: 'n.', definition: 'n. 预订；预约' },
      { word: 'dine in', partOfSpeech: 'v.', definition: 'v. 堂食' },
      { word: 'allergy', partOfSpeech: 'n.', definition: 'n. 过敏' },
      // ===== Describing Food =====
      { word: 'rare', partOfSpeech: 'adj.', definition: 'adj.（牛排）三分熟的' },
      { word: 'medium', partOfSpeech: 'adj.', definition: 'adj.（牛排）五分熟的' },
      { word: 'well-done', partOfSpeech: 'adj.', definition: 'adj.（牛排）全熟的' },
      { word: 'spicy', partOfSpeech: 'adj.', definition: 'adj. 辣的' },
      // ===== Dining Venues =====
      { word: 'cafeteria', partOfSpeech: 'n.', definition: 'n. 自助餐厅；食堂' },
      { word: 'food court', partOfSpeech: 'n.', definition: 'n. 美食广场' },
      { word: 'food truck', partOfSpeech: 'n.', definition: 'n. 餐车' },
    ]
  } else if (theme === 'hotel') {
    return [
      // ===== Booking =====
      { word: 'reservation', partOfSpeech: 'n.', definition: 'n. 预订；预约' },
      { word: 'vacancy', partOfSpeech: 'n.', definition: 'n. 空房' },
      { word: 'rate', partOfSpeech: 'n.', definition: 'n. 房价；费率' },
      { word: 'deposit', partOfSpeech: 'n.', definition: 'n. 押金；订金' },
      { word: 'cancellation', partOfSpeech: 'n.', definition: 'n. 取消' },
      { word: 'confirmation', partOfSpeech: 'n.', definition: 'n. 确认' },
      { word: 'check-in', partOfSpeech: 'n.', definition: 'n. 入住登记' },
      { word: 'check-out', partOfSpeech: 'n.', definition: 'n. 退房' },
      // ===== Room Types =====
      { word: 'single room', partOfSpeech: 'n.', definition: 'n. 单人间' },
      { word: 'double room', partOfSpeech: 'n.', definition: 'n. 双人间' },
      { word: 'suite', partOfSpeech: 'n.', definition: 'n. 套房' },
      { word: 'deluxe room', partOfSpeech: 'n.', definition: 'n. 豪华房' },
      // ===== Facilities =====
      { word: 'lobby', partOfSpeech: 'n.', definition: 'n. 大堂' },
      { word: 'elevator', partOfSpeech: 'n.', definition: 'n. 电梯' },
      { word: 'swimming pool', partOfSpeech: 'n.', definition: 'n. 游泳池' },
      { word: 'gym', partOfSpeech: 'n.', definition: 'n. 健身房' },
      { word: 'parking garage', partOfSpeech: 'n.', definition: 'n. 停车场（室内）' },
      // ===== Room Features =====
      { word: 'key card', partOfSpeech: 'n.', definition: 'n. 房卡' },
      { word: 'safe', partOfSpeech: 'n.', definition: 'n. 保险箱' },
      { word: 'minibar', partOfSpeech: 'n.', definition: 'n. 迷你吧' },
      { word: 'air conditioner', partOfSpeech: 'n.', definition: 'n. 空调' },
      { word: 'remote control', partOfSpeech: 'n.', definition: 'n. 遥控器' },
      { word: 'towel', partOfSpeech: 'n.', definition: 'n. 毛巾' },
      { word: 'pillow', partOfSpeech: 'n.', definition: 'n. 枕头' },
      { word: 'blanket', partOfSpeech: 'n.', definition: 'n. 毯子' },
      { word: 'hair dryer', partOfSpeech: 'n.', definition: 'n. 吹风机' },
      { word: 'toiletries', partOfSpeech: 'n.', definition: 'n. 洗漱用品（复数）' },
      { word: 'shampoo', partOfSpeech: 'n.', definition: 'n. 洗发水' },
      { word: 'soap', partOfSpeech: 'n.', definition: 'n. 肥皂' },
      // ===== Services & Staff =====
      { word: 'room service', partOfSpeech: 'n.', definition: 'n. 客房服务' },
      { word: 'laundry service', partOfSpeech: 'n.', definition: 'n. 洗衣服务' },
      { word: 'wake-up call', partOfSpeech: 'n.', definition: 'n. 叫醒服务' },
      { word: 'housekeeper', partOfSpeech: 'n.', definition: 'n. 客房服务员' },
      { word: 'receptionist', partOfSpeech: 'n.', definition: 'n. 前台接待员' },
      { word: 'concierge', partOfSpeech: 'n.', definition: 'n. 礼宾部' },
      { word: 'luggage', partOfSpeech: 'n.', definition: 'n. 行李' },
    ]
  } else if (theme === 'body') {
    return [
      // ===== Body Parts =====
      { word: 'head', partOfSpeech: 'n.', definition: 'n. 头；头部' },
      { word: 'forehead', partOfSpeech: 'n.', definition: 'n. 额头' },
      { word: 'jaw', partOfSpeech: 'n.', definition: 'n. 下巴；下颌' },
      { word: 'neck', partOfSpeech: 'n.', definition: 'n. 脖子；颈部' },
      { word: 'shoulder', partOfSpeech: 'n.', definition: 'n. 肩膀' },
      { word: 'arm', partOfSpeech: 'n.', definition: 'n. 手臂' },
      { word: 'elbow', partOfSpeech: 'n.', definition: 'n. 手肘' },
      { word: 'wrist', partOfSpeech: 'n.', definition: 'n. 手腕' },
      { word: 'hand', partOfSpeech: 'n.', definition: 'n. 手' },
      { word: 'finger', partOfSpeech: 'n.', definition: 'n. 手指' },
      { word: 'thumb', partOfSpeech: 'n.', definition: 'n. 拇指' },
      { word: 'chest', partOfSpeech: 'n.', definition: 'n. 胸部；胸膛' },
      { word: 'back', partOfSpeech: 'n.', definition: 'n. 背部；后背' },
      { word: 'stomach', partOfSpeech: 'n.', definition: 'n. 胃；肚子' },
      { word: 'waist', partOfSpeech: 'n.', definition: 'n. 腰；腰部' },
      { word: 'hip', partOfSpeech: 'n.', definition: 'n. 臀部；髋部' },
      { word: 'leg', partOfSpeech: 'n.', definition: 'n. 腿' },
      { word: 'knee', partOfSpeech: 'n.', definition: 'n. 膝盖' },
      { word: 'ankle', partOfSpeech: 'n.', definition: 'n. 脚踝' },
      { word: 'foot', partOfSpeech: 'n.', definition: 'n. 脚' },
      { word: 'toe', partOfSpeech: 'n.', definition: 'n. 脚趾' },
      { word: 'skin', partOfSpeech: 'n.', definition: 'n. 皮肤' },
      { word: 'muscle', partOfSpeech: 'n.', definition: 'n. 肌肉' },
      { word: 'bone', partOfSpeech: 'n.', definition: 'n. 骨头' },
      { word: 'joint', partOfSpeech: 'n.', definition: 'n. 关节' },
      // ===== Symptoms =====
      { word: 'headache', partOfSpeech: 'n.', definition: 'n. 头痛' },
      { word: 'stomachache', partOfSpeech: 'n.', definition: 'n. 肚子痛；胃痛' },
      { word: 'sore throat', partOfSpeech: 'n.', definition: 'n. 喉咙痛' },
      { word: 'fever', partOfSpeech: 'n.', definition: 'n. 发烧' },
      { word: 'cough', partOfSpeech: 'n./v.', definition: 'n./v. 咳嗽' },
      { word: 'cold', partOfSpeech: 'n.', definition: 'n. 感冒' },
      { word: 'dizzy', partOfSpeech: 'adj.', definition: 'adj. 头晕的' },
      { word: 'nausea', partOfSpeech: 'n.', definition: 'n. 恶心；想吐' },
      { word: 'bruise', partOfSpeech: 'n.', definition: 'n. 瘀伤；青肿' },
      { word: 'swollen', partOfSpeech: 'adj.', definition: 'adj. 肿胀的' },
      { word: 'rash', partOfSpeech: 'n.', definition: 'n. 皮疹' },
      { word: 'insomnia', partOfSpeech: 'n.', definition: 'n. 失眠' },
      // ===== Health Actions =====
      { word: 'breathe', partOfSpeech: 'v.', definition: 'v. 呼吸' },
      { word: 'swallow', partOfSpeech: 'v.', definition: 'v. 吞咽' },
      { word: 'sneeze', partOfSpeech: 'v.', definition: 'v. 打喷嚏' },
      { word: 'exercise', partOfSpeech: 'v./n.', definition: 'v./n. 锻炼；运动' },
      { word: 'stretch', partOfSpeech: 'v.', definition: 'v. 伸展；拉伸' },
      // ===== Medical =====
      { word: 'pharmacy', partOfSpeech: 'n.', definition: 'n. 药房' },
      { word: 'prescription', partOfSpeech: 'n.', definition: 'n. 处方；药方' },
      { word: 'medicine', partOfSpeech: 'n.', definition: 'n. 药；药物' },
      { word: 'pill', partOfSpeech: 'n.', definition: 'n. 药片；药丸' },
      { word: 'bandage', partOfSpeech: 'n.', definition: 'n. 绷带' },
      { word: 'thermometer', partOfSpeech: 'n.', definition: 'n. 温度计；体温计' },
      { word: 'vaccine', partOfSpeech: 'n.', definition: 'n. 疫苗' },
      { word: 'appointment', partOfSpeech: 'n.', definition: 'n. 预约（看医生）' },
    ]
  } else if (theme === 'office') {
    return [
      // ===== People & Roles =====
      { word: 'colleague', partOfSpeech: 'n.', definition: 'n. 同事' },
      { word: 'boss', partOfSpeech: 'n.', definition: 'n. 老板；上司' },
      { word: 'manager', partOfSpeech: 'n.', definition: 'n. 经理；主管' },
      { word: 'employee', partOfSpeech: 'n.', definition: 'n. 雇员；员工' },
      { word: 'employer', partOfSpeech: 'n.', definition: 'n. 雇主' },
      { word: 'intern', partOfSpeech: 'n.', definition: 'n. 实习生' },
      { word: 'secretary', partOfSpeech: 'n.', definition: 'n. 秘书' },
      // ===== Office Equipment =====
      { word: 'desk', partOfSpeech: 'n.', definition: 'n. 办公桌' },
      { word: 'chair', partOfSpeech: 'n.', definition: 'n. 椅子' },
      { word: 'computer', partOfSpeech: 'n.', definition: 'n. 电脑' },
      { word: 'keyboard', partOfSpeech: 'n.', definition: 'n. 键盘' },
      { word: 'monitor', partOfSpeech: 'n.', definition: 'n. 显示器' },
      { word: 'printer', partOfSpeech: 'n.', definition: 'n. 打印机' },
      { word: 'scanner', partOfSpeech: 'n.', definition: 'n. 扫描仪' },
      { word: 'photocopier', partOfSpeech: 'n.', definition: 'n. 复印机' },
      { word: 'stapler', partOfSpeech: 'n.', definition: 'n. 订书机' },
      { word: 'paper clip', partOfSpeech: 'n.', definition: 'n. 回形针' },
      { word: 'folder', partOfSpeech: 'n.', definition: 'n. 文件夹' },
      { word: 'filing cabinet', partOfSpeech: 'n.', definition: 'n. 文件柜' },
      { word: 'whiteboard', partOfSpeech: 'n.', definition: 'n. 白板' },
      // ===== Actions =====
      { word: 'type', partOfSpeech: 'v.', definition: 'v. 打字' },
      { word: 'print', partOfSpeech: 'v.', definition: 'v. 打印' },
      { word: 'scan', partOfSpeech: 'v.', definition: 'v. 扫描' },
      { word: 'copy', partOfSpeech: 'v.', definition: 'v. 复印' },
      { word: 'file', partOfSpeech: 'v.', definition: 'v. 归档' },
      { word: 'organize', partOfSpeech: 'v.', definition: 'v. 整理；组织' },
      { word: 'schedule', partOfSpeech: 'v.', definition: 'v. 安排时间' },
      { word: 'resign', partOfSpeech: 'v.', definition: 'v. 辞职' },
      // ===== Meetings =====
      { word: 'meeting', partOfSpeech: 'n.', definition: 'n. 会议' },
      { word: 'agenda', partOfSpeech: 'n.', definition: 'n. 议程' },
      { word: 'presentation', partOfSpeech: 'n.', definition: 'n. 演示；演讲' },
      { word: 'deadline', partOfSpeech: 'n.', definition: 'n. 截止日期' },
      { word: 'overtime', partOfSpeech: 'n.', definition: 'n. 加班' },
      { word: 'break', partOfSpeech: 'n.', definition: 'n. 休息时间' },
      // ===== Workplace Culture =====
      { word: 'salary', partOfSpeech: 'n.', definition: 'n. 工资；薪水' },
      { word: 'raise', partOfSpeech: 'n.', definition: 'n. 加薪' },
      { word: 'bonus', partOfSpeech: 'n.', definition: 'n. 奖金；分红' },
      { word: 'vacation', partOfSpeech: 'n.', definition: 'n. 休假；假期' },
      { word: 'sick leave', partOfSpeech: 'n.', definition: 'n. 病假' },
      { word: 'promotion', partOfSpeech: 'n.', definition: 'n. 升职' },
      { word: 'interview', partOfSpeech: 'n./v.', definition: 'n./v. 面试' },
    ]
  } else if (theme === 'technology') {
    return [
      // ===== Devices =====
      { word: 'smartphone', partOfSpeech: 'n.', definition: 'n. 智能手机' },
      { word: 'laptop', partOfSpeech: 'n.', definition: 'n. 笔记本电脑' },
      { word: 'tablet', partOfSpeech: 'n.', definition: 'n. 平板电脑' },
      { word: 'smartwatch', partOfSpeech: 'n.', definition: 'n. 智能手表' },
      { word: 'headphones', partOfSpeech: 'n.', definition: 'n. 头戴式耳机（复数）' },
      { word: 'earbuds', partOfSpeech: 'n.', definition: 'n. 入耳式耳机（复数）' },
      { word: 'speaker', partOfSpeech: 'n.', definition: 'n. 扬声器；音箱' },
      { word: 'router', partOfSpeech: 'n.', definition: 'n. 路由器' },
      { word: 'charger', partOfSpeech: 'n.', definition: 'n. 充电器' },
      { word: 'power bank', partOfSpeech: 'n.', definition: 'n. 充电宝' },
      { word: 'USB drive', partOfSpeech: 'n.', definition: 'n. U盘' },
      { word: 'external hard drive', partOfSpeech: 'n.', definition: 'n. 移动硬盘' },
      // ===== Internet & Software =====
      { word: 'Wi-Fi', partOfSpeech: 'n.', definition: 'n. 无线网络' },
      { word: 'broadband', partOfSpeech: 'n.', definition: 'n. 宽带' },
      { word: 'download', partOfSpeech: 'v./n.', definition: 'v./n. 下载' },
      { word: 'upload', partOfSpeech: 'v./n.', definition: 'v./n. 上传' },
      { word: 'update', partOfSpeech: 'v./n.', definition: 'v./n. 更新' },
      { word: 'install', partOfSpeech: 'v.', definition: 'v. 安装' },
      { word: 'uninstall', partOfSpeech: 'v.', definition: 'v. 卸载' },
      { word: 'backup', partOfSpeech: 'v./n.', definition: 'v./n. 备份' },
      { word: 'password', partOfSpeech: 'n.', definition: 'n. 密码' },
      { word: 'username', partOfSpeech: 'n.', definition: 'n. 用户名' },
      { word: 'account', partOfSpeech: 'n.', definition: 'n. 账号' },
      { word: 'app', partOfSpeech: 'n.', definition: 'n. 应用程序' },
      { word: 'notification', partOfSpeech: 'n.', definition: 'n. 通知' },
      // ===== Tech Actions =====
      { word: 'click', partOfSpeech: 'v.', definition: 'v. 点击' },
      { word: 'tap', partOfSpeech: 'v.', definition: 'v. 轻触' },
      { word: 'swipe', partOfSpeech: 'v.', definition: 'v. 滑动' },
      { word: 'scroll', partOfSpeech: 'v.', definition: 'v. 滚动' },
      { word: 'search', partOfSpeech: 'v.', definition: 'v. 搜索' },
      { word: 'log in', partOfSpeech: 'v.', definition: 'v. 登录' },
      { word: 'log out', partOfSpeech: 'v.', definition: 'v. 退出登录' },
      { word: 'restart', partOfSpeech: 'v.', definition: 'v. 重启' },
      { word: 'connect', partOfSpeech: 'v.', definition: 'v. 连接' },
      { word: 'disconnect', partOfSpeech: 'v.', definition: 'v. 断开连接' },
      { word: 'crash', partOfSpeech: 'v.', definition: 'v. （系统）崩溃' },
      // ===== Concepts =====
      { word: 'software', partOfSpeech: 'n.', definition: 'n. 软件' },
      { word: 'hardware', partOfSpeech: 'n.', definition: 'n. 硬件' },
      { word: 'data', partOfSpeech: 'n.', definition: 'n. 数据' },
      { word: 'file', partOfSpeech: 'n.', definition: 'n. 文件' },
      { word: 'folder', partOfSpeech: 'n.', definition: 'n. 文件夹' },
      { word: 'bug', partOfSpeech: 'n.', definition: 'n. （程序）漏洞；错误' },
      { word: 'screen', partOfSpeech: 'n.', definition: 'n. 屏幕' },
    ]
  } else if (theme === 'school') {
    return [
      // ===== People =====
      { word: 'teacher', partOfSpeech: 'n.', definition: 'n. 老师' },
      { word: 'professor', partOfSpeech: 'n.', definition: 'n. 教授' },
      { word: 'classmate', partOfSpeech: 'n.', definition: 'n. 同学' },
      { word: 'roommate', partOfSpeech: 'n.', definition: 'n. 室友' },
      { word: 'freshman', partOfSpeech: 'n.', definition: 'n. 大一新生' },
      { word: 'senior', partOfSpeech: 'n.', definition: 'n. 大四学生' },
      { word: 'graduate', partOfSpeech: 'n./v.', definition: 'n. 毕业生；v. 毕业' },
      // ===== Subjects =====
      { word: 'mathematics', partOfSpeech: 'n.', definition: 'n. 数学' },
      { word: 'physics', partOfSpeech: 'n.', definition: 'n. 物理' },
      { word: 'chemistry', partOfSpeech: 'n.', definition: 'n. 化学' },
      { word: 'biology', partOfSpeech: 'n.', definition: 'n. 生物' },
      { word: 'literature', partOfSpeech: 'n.', definition: 'n. 文学' },
      { word: 'history', partOfSpeech: 'n.', definition: 'n. 历史' },
      { word: 'philosophy', partOfSpeech: 'n.', definition: 'n. 哲学' },
      { word: 'psychology', partOfSpeech: 'n.', definition: 'n. 心理学' },
      // ===== Campus =====
      { word: 'campus', partOfSpeech: 'n.', definition: 'n. 校园' },
      { word: 'dormitory', partOfSpeech: 'n.', definition: 'n. 宿舍' },
      { word: 'library', partOfSpeech: 'n.', definition: 'n. 图书馆' },
      { word: 'cafeteria', partOfSpeech: 'n.', definition: 'n. 食堂；自助餐厅' },
      { word: 'laboratory', partOfSpeech: 'n.', definition: 'n. 实验室' },
      { word: 'lecture hall', partOfSpeech: 'n.', definition: 'n. 大教室；报告厅' },
      { word: 'playground', partOfSpeech: 'n.', definition: 'n. 操场' },
      // ===== Academics =====
      { word: 'lecture', partOfSpeech: 'n.', definition: 'n. 讲座；讲课' },
      { word: 'seminar', partOfSpeech: 'n.', definition: 'n. 研讨会；讨论课' },
      { word: 'assignment', partOfSpeech: 'n.', definition: 'n. 作业；任务' },
      { word: 'homework', partOfSpeech: 'n.', definition: 'n. 家庭作业' },
      { word: 'exam', partOfSpeech: 'n.', definition: 'n. 考试' },
      { word: 'quiz', partOfSpeech: 'n.', definition: 'n. 小测验' },
      { word: 'grade', partOfSpeech: 'n.', definition: 'n. 成绩；分数' },
      { word: 'score', partOfSpeech: 'n.', definition: 'n. 得分' },
      { word: 'credit', partOfSpeech: 'n.', definition: 'n. 学分' },
      { word: 'major', partOfSpeech: 'n.', definition: 'n. 专业' },
      { word: 'minor', partOfSpeech: 'n.', definition: 'n. 辅修专业' },
      { word: 'scholarship', partOfSpeech: 'n.', definition: 'n. 奖学金' },
      { word: 'degree', partOfSpeech: 'n.', definition: 'n. 学位' },
      { word: 'diploma', partOfSpeech: 'n.', definition: 'n. 毕业证书' },
      { word: 'thesis', partOfSpeech: 'n.', definition: 'n. 论文；毕业论文' },
      { word: 'syllabus', partOfSpeech: 'n.', definition: 'n. 教学大纲' },
      // ===== Actions =====
      { word: 'study', partOfSpeech: 'v.', definition: 'v. 学习' },
      { word: 'review', partOfSpeech: 'v.', definition: 'v. 复习' },
      { word: 'memorize', partOfSpeech: 'v.', definition: 'v. 记住；背诵' },
      { word: 'skip', partOfSpeech: 'v.', definition: 'v. 翘（课）' },
      { word: 'register', partOfSpeech: 'v.', definition: 'v. 注册；选课' },
      { word: 'attend', partOfSpeech: 'v.', definition: 'v. 参加；出席' },
    ]
  } else if (theme === 'sports') {
    return [
      // ===== Sports Types =====
      { word: 'soccer', partOfSpeech: 'n.', definition: 'n. 足球' },
      { word: 'basketball', partOfSpeech: 'n.', definition: 'n. 篮球' },
      { word: 'volleyball', partOfSpeech: 'n.', definition: 'n. 排球' },
      { word: 'tennis', partOfSpeech: 'n.', definition: 'n. 网球' },
      { word: 'badminton', partOfSpeech: 'n.', definition: 'n. 羽毛球' },
      { word: 'table tennis', partOfSpeech: 'n.', definition: 'n. 乒乓球' },
      { word: 'swimming', partOfSpeech: 'n.', definition: 'n. 游泳' },
      { word: 'running', partOfSpeech: 'n.', definition: 'n. 跑步' },
      { word: 'jogging', partOfSpeech: 'n.', definition: 'n. 慢跑' },
      { word: 'cycling', partOfSpeech: 'n.', definition: 'n. 骑行；自行车运动' },
      { word: 'yoga', partOfSpeech: 'n.', definition: 'n. 瑜伽' },
      // ===== Equipment =====
      { word: 'ball', partOfSpeech: 'n.', definition: 'n. 球' },
      { word: 'racket', partOfSpeech: 'n.', definition: 'n. 球拍' },
      { word: 'bat', partOfSpeech: 'n.', definition: 'n. 球棒；球拍' },
      { word: 'net', partOfSpeech: 'n.', definition: 'n. 网' },
      { word: 'goal', partOfSpeech: 'n.', definition: 'n. 球门' },
      { word: 'hoop', partOfSpeech: 'n.', definition: 'n. 篮筐' },
      { word: 'gym', partOfSpeech: 'n.', definition: 'n. 健身房；体育馆' },
      { word: 'stadium', partOfSpeech: 'n.', definition: 'n. 体育场' },
      { word: 'track', partOfSpeech: 'n.', definition: 'n. 跑道' },
      // ===== Actions & Rules =====
      { word: 'score', partOfSpeech: 'v.', definition: 'v. 得分' },
      { word: 'win', partOfSpeech: 'v.', definition: 'v. 赢；获胜' },
      { word: 'lose', partOfSpeech: 'v.', definition: 'v. 输；失败' },
      { word: 'tie', partOfSpeech: 'v./n.', definition: 'v. 打成平手；n. 平局' },
      { word: 'compete', partOfSpeech: 'v.', definition: 'v. 竞争；比赛' },
      { word: 'stretch', partOfSpeech: 'v.', definition: 'v. 拉伸' },
      { word: 'warm up', partOfSpeech: 'v.', definition: 'v. 热身' },
      { word: 'work out', partOfSpeech: 'v.', definition: 'v. 锻炼' },
      // ===== People =====
      { word: 'coach', partOfSpeech: 'n.', definition: 'n. 教练' },
      { word: 'player', partOfSpeech: 'n.', definition: 'n. 运动员；选手' },
      { word: 'captain', partOfSpeech: 'n.', definition: 'n. 队长' },
      { word: 'referee', partOfSpeech: 'n.', definition: 'n. 裁判' },
      { word: 'spectator', partOfSpeech: 'n.', definition: 'n. 观众' },
      { word: 'fan', partOfSpeech: 'n.', definition: 'n. 粉丝；爱好者' },
      { word: 'champion', partOfSpeech: 'n.', definition: 'n. 冠军' },
    ]
  } else if (theme === 'shopping') {
    return [
      // ===== Stores & Places =====
      { word: 'supermarket', partOfSpeech: 'n.', definition: 'n. 超市' },
      { word: 'grocery store', partOfSpeech: 'n.', definition: 'n. 杂货店；食品店' },
      { word: 'department store', partOfSpeech: 'n.', definition: 'n. 百货商场' },
      { word: 'shopping mall', partOfSpeech: 'n.', definition: 'n. 购物中心' },
      { word: 'convenience store', partOfSpeech: 'n.', definition: 'n. 便利店' },
      { word: 'pharmacy', partOfSpeech: 'n.', definition: 'n. 药店' },
      { word: 'bakery', partOfSpeech: 'n.', definition: 'n. 面包店' },
      { word: 'butcher', partOfSpeech: 'n.', definition: 'n. 肉铺；肉贩' },
      { word: 'market', partOfSpeech: 'n.', definition: 'n. 市场；集市' },
      { word: 'cash register', partOfSpeech: 'n.', definition: 'n. 收银机' },
      // ===== Actions =====
      { word: 'buy', partOfSpeech: 'v.', definition: 'v. 购买' },
      { word: 'purchase', partOfSpeech: 'v.', definition: 'v. 购买（正式）' },
      { word: 'sell', partOfSpeech: 'v.', definition: 'v. 卖；销售' },
      { word: 'pay', partOfSpeech: 'v.', definition: 'v. 付款' },
      { word: 'spend', partOfSpeech: 'v.', definition: 'v. 花费（钱）' },
      { word: 'save', partOfSpeech: 'v.', definition: 'v. 节省；存钱' },
      { word: 'bargain', partOfSpeech: 'v./n.', definition: 'v. 讨价还价；n. 便宜货' },
      { word: 'refund', partOfSpeech: 'v./n.', definition: 'v./n. 退款' },
      { word: 'exchange', partOfSpeech: 'v.', definition: 'v. 换货' },
      { word: 'try on', partOfSpeech: 'v.', definition: 'v. 试穿' },
      { word: 'wrap', partOfSpeech: 'v.', definition: 'v. 包装；打包' },
      // ===== Payment =====
      { word: 'cash', partOfSpeech: 'n.', definition: 'n. 现金' },
      { word: 'credit card', partOfSpeech: 'n.', definition: 'n. 信用卡' },
      { word: 'debit card', partOfSpeech: 'n.', definition: 'n. 借记卡' },
      { word: 'change', partOfSpeech: 'n.', definition: 'n. 零钱；找零' },
      { word: 'receipt', partOfSpeech: 'n.', definition: 'n. 收据；小票' },
      { word: 'coupon', partOfSpeech: 'n.', definition: 'n. 优惠券' },
      { word: 'discount', partOfSpeech: 'n.', definition: 'n. 折扣' },
      { word: 'sale', partOfSpeech: 'n.', definition: 'n. 促销；减价' },
      // ===== Shopping Concepts =====
      { word: 'price', partOfSpeech: 'n.', definition: 'n. 价格' },
      { word: 'tag', partOfSpeech: 'n.', definition: 'n. 标签；价签' },
      { word: 'size', partOfSpeech: 'n.', definition: 'n. 尺码；尺寸' },
      { word: 'brand', partOfSpeech: 'n.', definition: 'n. 品牌' },
      { word: 'customer', partOfSpeech: 'n.', definition: 'n. 顾客' },
      { word: 'shopping cart', partOfSpeech: 'n.', definition: 'n. 购物车' },
      { word: 'shopping bag', partOfSpeech: 'n.', definition: 'n. 购物袋' },
      { word: 'checkout', partOfSpeech: 'n.', definition: 'n. 收银台' },
    ]
  } else if (theme === 'transportation') {
    return [
      // ===== Public Transit =====
      { word: 'bus', partOfSpeech: 'n.', definition: 'n. 公共汽车' },
      { word: 'subway', partOfSpeech: 'n.', definition: 'n. 地铁' },
      { word: 'train', partOfSpeech: 'n.', definition: 'n. 火车' },
      { word: 'high-speed rail', partOfSpeech: 'n.', definition: 'n. 高铁' },
      { word: 'taxi', partOfSpeech: 'n.', definition: 'n. 出租车' },
      { word: 'ride-hailing', partOfSpeech: 'n.', definition: 'n. 网约车' },
      { word: 'ferry', partOfSpeech: 'n.', definition: 'n. 渡轮' },
      { word: 'airplane', partOfSpeech: 'n.', definition: 'n. 飞机' },
      // ===== Ticket & Fare =====
      { word: 'ticket', partOfSpeech: 'n.', definition: 'n. 票；车票' },
      { word: 'one-way ticket', partOfSpeech: 'n.', definition: 'n. 单程票' },
      { word: 'round-trip ticket', partOfSpeech: 'n.', definition: 'n. 往返票' },
      { word: 'transfer', partOfSpeech: 'v./n.', definition: 'v./n. 换乘；转机' },
      { word: 'fare', partOfSpeech: 'n.', definition: 'n. 车费；票价' },
      { word: 'schedule', partOfSpeech: 'n.', definition: 'n. 时刻表' },
      { word: 'platform', partOfSpeech: 'n.', definition: 'n. 站台；月台' },
      { word: 'terminal', partOfSpeech: 'n.', definition: 'n. 航站楼；终点站' },
      { word: 'route', partOfSpeech: 'n.', definition: 'n. 路线' },
      // ===== Airport =====
      { word: 'departure', partOfSpeech: 'n.', definition: 'n. 出发；起飞' },
      { word: 'arrival', partOfSpeech: 'n.', definition: 'n. 到达；抵达' },
      { word: 'boarding pass', partOfSpeech: 'n.', definition: 'n. 登机牌' },
      { word: 'security check', partOfSpeech: 'n.', definition: 'n. 安检' },
      { word: 'gate', partOfSpeech: 'n.', definition: 'n. 登机口' },
      { word: 'delay', partOfSpeech: 'v./n.', definition: 'v./n. 延误；晚点' },
      { word: 'customs', partOfSpeech: 'n.', definition: 'n. 海关' },
      { word: 'passport', partOfSpeech: 'n.', definition: 'n. 护照' },
      // ===== Traffic Situations =====
      { word: 'rush hour', partOfSpeech: 'n.', definition: 'n. 高峰时间' },
      { word: 'traffic jam', partOfSpeech: 'n.', definition: 'n. 交通堵塞' },
      { word: 'commute', partOfSpeech: 'v./n.', definition: 'v./n. 通勤' },
      { word: 'passenger', partOfSpeech: 'n.', definition: 'n. 乘客' },
      { word: 'aisle', partOfSpeech: 'n.', definition: 'n. 过道；通道' },
      { word: 'seat', partOfSpeech: 'n.', definition: 'n. 座位' },
      { word: 'window seat', partOfSpeech: 'n.', definition: 'n. 靠窗座位' },
      { word: 'aisle seat', partOfSpeech: 'n.', definition: 'n. 靠过道座位' },
      { word: 'stop', partOfSpeech: 'n.', definition: 'n. 车站；停靠站' },
    ]
  } else if (theme === 'entertainment') {
    return [
      // ===== Movies & Theater =====
      { word: 'movie', partOfSpeech: 'n.', definition: 'n. 电影' },
      { word: 'cinema', partOfSpeech: 'n.', definition: 'n. 电影院' },
      { word: 'ticket', partOfSpeech: 'n.', definition: 'n. 票；电影票' },
      { word: 'trailer', partOfSpeech: 'n.', definition: 'n. 预告片' },
      { word: 'genre', partOfSpeech: 'n.', definition: 'n. 类型；流派' },
      { word: 'comedy', partOfSpeech: 'n.', definition: 'n. 喜剧' },
      { word: 'drama', partOfSpeech: 'n.', definition: 'n. 剧情片；戏剧' },
      { word: 'horror', partOfSpeech: 'n.', definition: 'n. 恐怖片' },
      { word: 'science fiction', partOfSpeech: 'n.', definition: 'n. 科幻片' },
      { word: 'documentary', partOfSpeech: 'n.', definition: 'n. 纪录片' },
      { word: 'actor', partOfSpeech: 'n.', definition: 'n. 演员（男）' },
      { word: 'actress', partOfSpeech: 'n.', definition: 'n. 女演员' },
      { word: 'director', partOfSpeech: 'n.', definition: 'n. 导演' },
      { word: 'character', partOfSpeech: 'n.', definition: 'n. 角色' },
      { word: 'plot', partOfSpeech: 'n.', definition: 'n. 情节' },
      { word: 'spoil', partOfSpeech: 'v.', definition: 'v. 剧透' },
      // ===== Music =====
      { word: 'song', partOfSpeech: 'n.', definition: 'n. 歌曲' },
      { word: 'lyrics', partOfSpeech: 'n.', definition: 'n. 歌词（复数）' },
      { word: 'concert', partOfSpeech: 'n.', definition: 'n. 演唱会；音乐会' },
      { word: 'band', partOfSpeech: 'n.', definition: 'n. 乐队' },
      { word: 'album', partOfSpeech: 'n.', definition: 'n. 专辑' },
      // ===== Games =====
      { word: 'game', partOfSpeech: 'n.', definition: 'n. 游戏' },
      { word: 'video game', partOfSpeech: 'n.', definition: 'n. 电子游戏' },
      { word: 'board game', partOfSpeech: 'n.', definition: 'n. 桌游' },
      { word: 'level', partOfSpeech: 'n.', definition: 'n. 关卡；等级' },
      // ===== Activities =====
      { word: 'party', partOfSpeech: 'n.', definition: 'n. 派对；聚会' },
      { word: 'hobby', partOfSpeech: 'n.', definition: 'n. 爱好' },
      { word: 'photography', partOfSpeech: 'n.', definition: 'n. 摄影' },
      { word: 'festival', partOfSpeech: 'n.', definition: 'n. 节日；音乐节' },
      { word: 'karaoke', partOfSpeech: 'n.', definition: 'n. 卡拉OK' },
    ]
  } else if (theme === 'weather') {
    return [
      // ===== Weather Conditions =====
      { word: 'sunny', partOfSpeech: 'adj.', definition: 'adj. 晴郎的' },
      { word: 'cloudy', partOfSpeech: 'adj.', definition: 'adj. 多云的；阴天的' },
      { word: 'rainy', partOfSpeech: 'adj.', definition: 'adj. 下雨的' },
      { word: 'windy', partOfSpeech: 'adj.', definition: 'adj. 有风的' },
      { word: 'foggy', partOfSpeech: 'adj.', definition: 'adj. 有雾的' },
      { word: 'stormy', partOfSpeech: 'adj.', definition: 'adj. 暴风雨的' },
      { word: 'humid', partOfSpeech: 'adj.', definition: 'adj. 潮湿的' },
      { word: 'dry', partOfSpeech: 'adj.', definition: 'adj. 干燥的' },
      { word: 'freezing', partOfSpeech: 'adj.', definition: 'adj. 极冷的；冰冻的' },
      { word: 'chilly', partOfSpeech: 'adj.', definition: 'adj. 凉飕飕的' },
      { word: 'cool', partOfSpeech: 'adj.', definition: 'adj. 凉爽的' },
      { word: 'warm', partOfSpeech: 'adj.', definition: 'adj. 温暖的' },
      { word: 'hot', partOfSpeech: 'adj.', definition: 'adj. 热的' },
      { word: 'mild', partOfSpeech: 'adj.', definition: 'adj. 温和的' },
      // ===== Natural Phenomena =====
      { word: 'rain', partOfSpeech: 'n./v.', definition: 'n. 雨；v. 下雨' },
      { word: 'snow', partOfSpeech: 'n./v.', definition: 'n. 雪；v. 下雪' },
      { word: 'storm', partOfSpeech: 'n.', definition: 'n. 暴风雨' },
      { word: 'thunder', partOfSpeech: 'n.', definition: 'n. 雷' },
      { word: 'lightning', partOfSpeech: 'n.', definition: 'n. 闪电' },
      { word: 'typhoon', partOfSpeech: 'n.', definition: 'n. 台风' },
      { word: 'flood', partOfSpeech: 'n.', definition: 'n. 洪水' },
      // ===== Seasons =====
      { word: 'spring', partOfSpeech: 'n.', definition: 'n. 春天' },
      { word: 'summer', partOfSpeech: 'n.', definition: 'n. 夏天' },
      { word: 'autumn', partOfSpeech: 'n.', definition: 'n. 秋天' },
      { word: 'winter', partOfSpeech: 'n.', definition: 'n. 冬天' },
      { word: 'season', partOfSpeech: 'n.', definition: 'n. 季节' },
      // ===== Temperature & Forecast =====
      { word: 'temperature', partOfSpeech: 'n.', definition: 'n. 温度；气温' },
      { word: 'degree', partOfSpeech: 'n.', definition: 'n. 度；度数' },
      { word: 'forecast', partOfSpeech: 'n./v.', definition: 'n./v. 天气预报；预测' },
      { word: 'umbrella', partOfSpeech: 'n.', definition: 'n. 雨伞' },
      { word: 'heater', partOfSpeech: 'n.', definition: 'n. 暖气；加热器' },
      { word: 'climate', partOfSpeech: 'n.', definition: 'n. 气候' },
    ]
  } else if (theme === 'home') {
    return [
      // ===== Living Room =====
      { word: 'sofa', partOfSpeech: 'n.', definition: 'n. 沙发' },
      { word: 'coffee table', partOfSpeech: 'n.', definition: 'n. 茶几' },
      { word: 'bookshelf', partOfSpeech: 'n.', definition: 'n. 书架' },
      { word: 'television', partOfSpeech: 'n.', definition: 'n. 电视' },
      { word: 'lamp', partOfSpeech: 'n.', definition: 'n. 灯；台灯' },
      { word: 'curtain', partOfSpeech: 'n.', definition: 'n. 窗帘' },
      { word: 'rug', partOfSpeech: 'n.', definition: 'n. 地毯' },
      // ===== Bedroom =====
      { word: 'bed', partOfSpeech: 'n.', definition: 'n. 床' },
      { word: 'mattress', partOfSpeech: 'n.', definition: 'n. 床垫' },
      { word: 'alarm clock', partOfSpeech: 'n.', definition: 'n. 闹钟' },
      { word: 'wardrobe', partOfSpeech: 'n.', definition: 'n. 衣柜' },
      { word: 'nightstand', partOfSpeech: 'n.', definition: 'n. 床头柜' },
      // ===== Bathroom =====
      { word: 'shower', partOfSpeech: 'n.', definition: 'n. 淋浴' },
      { word: 'bathtub', partOfSpeech: 'n.', definition: 'n. 浴缸' },
      { word: 'toilet', partOfSpeech: 'n.', definition: 'n. 马桶' },
      { word: 'mirror', partOfSpeech: 'n.', definition: 'n. 镜子' },
      { word: 'toothbrush', partOfSpeech: 'n.', definition: 'n. 牙刷' },
      { word: 'toothpaste', partOfSpeech: 'n.', definition: 'n. 牙膏' },
      // ===== Household Items =====
      { word: 'door', partOfSpeech: 'n.', definition: 'n. 门' },
      { word: 'window', partOfSpeech: 'n.', definition: 'n. 窗户' },
      { word: 'key', partOfSpeech: 'n.', definition: 'n. 钥匙' },
      { word: 'lock', partOfSpeech: 'n./v.', definition: 'n. 锁；v. 上锁' },
      { word: 'switch', partOfSpeech: 'n.', definition: 'n. 开关' },
      { word: 'socket', partOfSpeech: 'n.', definition: 'n. 插座' },
      { word: 'broom', partOfSpeech: 'n.', definition: 'n. 扫帚' },
      { word: 'vacuum cleaner', partOfSpeech: 'n.', definition: 'n. 吸尘器' },
      { word: 'washing machine', partOfSpeech: 'n.', definition: 'n. 洗衣机' },
      // ===== Actions =====
      { word: 'sweep', partOfSpeech: 'v.', definition: 'v. 扫地' },
      { word: 'mop', partOfSpeech: 'v.', definition: 'v. 拖地' },
      { word: 'dust', partOfSpeech: 'v.', definition: 'v. 擦灰' },
      { word: 'tidy up', partOfSpeech: 'v.', definition: 'v. 整理' },
      { word: 'decorate', partOfSpeech: 'v.', definition: 'v. 装饰' },
      { word: 'move', partOfSpeech: 'v.', definition: 'v. 搬家' },
      { word: 'furniture', partOfSpeech: 'n.', definition: 'n. 家具' },
    ]
  } else if (theme === 'people') {
    return [
      // ===== Family =====
      { word: 'mother', partOfSpeech: 'n.', definition: 'n. 母亲；妈妈' },
      { word: 'father', partOfSpeech: 'n.', definition: 'n. 父亲；爸爸' },
      { word: 'parent', partOfSpeech: 'n.', definition: 'n. 父母' },
      { word: 'son', partOfSpeech: 'n.', definition: 'n. 儿子' },
      { word: 'daughter', partOfSpeech: 'n.', definition: 'n. 女儿' },
      { word: 'brother', partOfSpeech: 'n.', definition: 'n. 兄弟' },
      { word: 'sister', partOfSpeech: 'n.', definition: 'n. 姐妹' },
      { word: 'husband', partOfSpeech: 'n.', definition: 'n. 丈夫' },
      { word: 'wife', partOfSpeech: 'n.', definition: 'n. 妻子' },
      { word: 'grandfather', partOfSpeech: 'n.', definition: 'n. 祖父；爷爷' },
      { word: 'grandmother', partOfSpeech: 'n.', definition: 'n. 祖母；奶奶' },
      { word: 'uncle', partOfSpeech: 'n.', definition: 'n. 叔叔；舅舅' },
      { word: 'aunt', partOfSpeech: 'n.', definition: 'n. 阿姨；姑姑' },
      { word: 'cousin', partOfSpeech: 'n.', definition: 'n. 表兄弟姐妹' },
      { word: 'nephew', partOfSpeech: 'n.', definition: 'n. 侄子；外甥' },
      { word: 'niece', partOfSpeech: 'n.', definition: 'n. 侄女；外甥女' },
      // ===== Personal Traits =====
      { word: 'tall', partOfSpeech: 'adj.', definition: 'adj. 高的' },
      { word: 'short', partOfSpeech: 'adj.', definition: 'adj. 矮的' },
      { word: 'slim', partOfSpeech: 'adj.', definition: 'adj. 苗条的' },
      { word: 'strong', partOfSpeech: 'adj.', definition: 'adj. 强壮的' },
      { word: 'young', partOfSpeech: 'adj.', definition: 'adj. 年轻的' },
      { word: 'old', partOfSpeech: 'adj.', definition: 'adj. 年老的' },
      // ===== Personality =====
      { word: 'friendly', partOfSpeech: 'adj.', definition: 'adj. 友好的' },
      { word: 'shy', partOfSpeech: 'adj.', definition: 'adj. 害羞的' },
      { word: 'outgoing', partOfSpeech: 'adj.', definition: 'adj. 外向的' },
      { word: 'funny', partOfSpeech: 'adj.', definition: 'adj. 有趣的' },
      { word: 'smart', partOfSpeech: 'adj.', definition: 'adj. 聪明的' },
      { word: 'kind', partOfSpeech: 'adj.', definition: 'adj. 善良的' },
      { word: 'honest', partOfSpeech: 'adj.', definition: 'adj. 诚实的' },
      { word: 'brave', partOfSpeech: 'adj.', definition: 'adj. 勇敢的' },
      { word: 'lazy', partOfSpeech: 'adj.', definition: 'adj. 懒惰的' },
      { word: 'hardworking', partOfSpeech: 'adj.', definition: 'adj. 努力工作的' },
      { word: 'generous', partOfSpeech: 'adj.', definition: 'adj. 慷慨的' },
      { word: 'stubborn', partOfSpeech: 'adj.', definition: 'adj. 固执的' },
      { word: 'patient', partOfSpeech: 'adj.', definition: 'adj. 有耐心的' },
    ]
  } else if (theme === 'mechanical-engineering') {
    return [
      // ===== Core Mechanical Concepts =====
      { word: 'mechanics', partOfSpeech: 'n.', definition: 'n. 力学；机械学' },
      { word: 'statics', partOfSpeech: 'n.', definition: 'n. 静力学' },
      { word: 'dynamics', partOfSpeech: 'n.', definition: 'n. 动力学' },
      { word: 'kinematics', partOfSpeech: 'n.', definition: 'n. 运动学' },
      { word: 'thermodynamics', partOfSpeech: 'n.', definition: 'n. 热力学' },
      { word: 'fluid mechanics', partOfSpeech: 'n.', definition: 'n. 流体力学' },
      { word: 'stress', partOfSpeech: 'n.', definition: 'n. 应力' },
      { word: 'strain', partOfSpeech: 'n.', definition: 'n. 应变' },
      { word: 'torque', partOfSpeech: 'n.', definition: 'n. 扭矩；转矩' },
      { word: 'shear force', partOfSpeech: 'n.', definition: 'n. 剪切力' },
      { word: 'fatigue', partOfSpeech: 'n.', definition: 'n. 疲劳（材料）' },
      // ===== Materials & Properties =====
      { word: 'alloy', partOfSpeech: 'n.', definition: 'n. 合金' },
      { word: 'stainless steel', partOfSpeech: 'n.', definition: 'n. 不锈钢' },
      { word: 'carbon steel', partOfSpeech: 'n.', definition: 'n. 碳钢' },
      { word: 'aluminum', partOfSpeech: 'n.', definition: 'n. 铝' },
      { word: 'composite', partOfSpeech: 'n.', definition: 'n. 复合材料' },
      { word: 'polymer', partOfSpeech: 'n.', definition: 'n. 聚合物' },
      { word: 'hardness', partOfSpeech: 'n.', definition: 'n. 硬度' },
      { word: 'toughness', partOfSpeech: 'n.', definition: 'n. 韧性' },
      { word: 'ductility', partOfSpeech: 'n.', definition: 'n. 延展性' },
      // ===== Manufacturing & Processes =====
      { word: 'machining', partOfSpeech: 'n.', definition: 'n. 机械加工' },
      { word: 'welding', partOfSpeech: 'n.', definition: 'n. 焊接' },
      { word: 'casting', partOfSpeech: 'n.', definition: 'n. 铸造' },
      { word: 'forging', partOfSpeech: 'n.', definition: 'n. 锻造' },
      { word: 'extrusion', partOfSpeech: 'n.', definition: 'n. 挤压；挤出' },
      { word: 'injection molding', partOfSpeech: 'n.', definition: 'n. 注塑成型' },
      { word: 'CNC', partOfSpeech: 'n.', definition: 'n. 计算机数控' },
      { word: 'tolerance', partOfSpeech: 'n.', definition: 'n. 公差' },
      // ===== Machine Elements =====
      { word: 'bearing', partOfSpeech: 'n.', definition: 'n. 轴承' },
      { word: 'gear', partOfSpeech: 'n.', definition: 'n. 齿轮' },
      { word: 'shaft', partOfSpeech: 'n.', definition: 'n. 轴；传动轴' },
      { word: 'piston', partOfSpeech: 'n.', definition: 'n. 活塞' },
      { word: 'valve', partOfSpeech: 'n.', definition: 'n. 阀门' },
      { word: 'spring', partOfSpeech: 'n.', definition: 'n. 弹簧' },
      { word: 'pulley', partOfSpeech: 'n.', definition: 'n. 滑轮' },
      { word: 'belt', partOfSpeech: 'n.', definition: 'n. 皮带；传送带' },
      { word: 'chain', partOfSpeech: 'n.', definition: 'n. 链条' },
      { word: 'actuator', partOfSpeech: 'n.', definition: 'n. 执行器；驱动器' },
      // ===== Design & Analysis =====
      { word: 'blueprint', partOfSpeech: 'n.', definition: 'n. 蓝图' },
      { word: 'schematic', partOfSpeech: 'n.', definition: 'n. 示意图；原理图' },
      { word: 'finite element analysis', partOfSpeech: 'n.', definition: 'n. 有限元分析' },
      { word: 'prototype', partOfSpeech: 'n.', definition: 'n. 原型；样机' },
      { word: 'CAD', partOfSpeech: 'n.', definition: 'n. 计算机辅助设计' },
      { word: 'assembly', partOfSpeech: 'n.', definition: 'n. 装配；总成' },
      { word: 'vibration', partOfSpeech: 'n.', definition: 'n. 振动' },
    ]
  } else if (theme === 'computer-ai') {
    return [
      // ===== Programming & Software =====
      { word: 'algorithm', partOfSpeech: 'n.', definition: 'n. 算法' },
      { word: 'data structure', partOfSpeech: 'n.', definition: 'n. 数据结构' },
      { word: 'variable', partOfSpeech: 'n.', definition: 'n. 变量' },
      { word: 'function', partOfSpeech: 'n.', definition: 'n. 函数；方法' },
      { word: 'loop', partOfSpeech: 'n.', definition: 'n. 循环' },
      { word: 'recursion', partOfSpeech: 'n.', definition: 'n. 递归' },
      { word: 'compiler', partOfSpeech: 'n.', definition: 'n. 编译器' },
      { word: 'debug', partOfSpeech: 'v.', definition: 'v. 调试；排错' },
      { word: 'framework', partOfSpeech: 'n.', definition: 'n. 框架' },
      { word: 'library', partOfSpeech: 'n.', definition: 'n. 库；程序库' },
      { word: 'API', partOfSpeech: 'n.', definition: 'n. 应用程序接口' },
      { word: 'database', partOfSpeech: 'n.', definition: 'n. 数据库' },
      { word: 'cache', partOfSpeech: 'n./v.', definition: 'n. 缓存；v. 缓存存储' },
      { word: 'server', partOfSpeech: 'n.', definition: 'n. 服务器' },
      { word: 'deployment', partOfSpeech: 'n.', definition: 'n. 部署；上线' },
      // ===== AI & Machine Learning =====
      { word: 'neural network', partOfSpeech: 'n.', definition: 'n. 神经网络' },
      { word: 'deep learning', partOfSpeech: 'n.', definition: 'n. 深度学习' },
      { word: 'machine learning', partOfSpeech: 'n.', definition: 'n. 机器学习' },
      { word: 'supervised learning', partOfSpeech: 'n.', definition: 'n. 监督学习' },
      { word: 'unsupervised learning', partOfSpeech: 'n.', definition: 'n. 无监督学习' },
      { word: 'reinforcement learning', partOfSpeech: 'n.', definition: 'n. 强化学习' },
      { word: 'regression', partOfSpeech: 'n.', definition: 'n. 回归' },
      { word: 'classification', partOfSpeech: 'n.', definition: 'n. 分类' },
      { word: 'clustering', partOfSpeech: 'n.', definition: 'n. 聚类' },
      { word: 'overfitting', partOfSpeech: 'n.', definition: 'n. 过拟合' },
      { word: 'gradient descent', partOfSpeech: 'n.', definition: 'n. 梯度下降' },
      { word: 'backpropagation', partOfSpeech: 'n.', definition: 'n. 反向传播' },
      { word: 'transformer', partOfSpeech: 'n.', definition: 'n. Transformer模型' },
      { word: 'attention mechanism', partOfSpeech: 'n.', definition: 'n. 注意力机制' },
      { word: 'LLM', partOfSpeech: 'n.', definition: 'n. 大语言模型' },
      { word: 'embedding', partOfSpeech: 'n.', definition: 'n. 嵌入；向量表示' },
      { word: 'token', partOfSpeech: 'n.', definition: 'n. 词元；令牌' },
      { word: 'fine-tuning', partOfSpeech: 'n.', definition: 'n. 微调' },
      { word: 'inference', partOfSpeech: 'n.', definition: 'n. 推理' },
      // ===== Data & Infrastructure =====
      { word: 'big data', partOfSpeech: 'n.', definition: 'n. 大数据' },
      { word: 'cloud computing', partOfSpeech: 'n.', definition: 'n. 云计算' },
      { word: 'virtualization', partOfSpeech: 'n.', definition: 'n. 虚拟化' },
      { word: 'container', partOfSpeech: 'n.', definition: 'n. 容器' },
      { word: 'encryption', partOfSpeech: 'n.', definition: 'n. 加密' },
      { word: 'latency', partOfSpeech: 'n.', definition: 'n. 延迟；等待时间' },
      { word: 'bandwidth', partOfSpeech: 'n.', definition: 'n. 带宽' },
      { word: 'scalability', partOfSpeech: 'n.', definition: 'n. 可扩展性' },
    ]
  } else if (theme === 'automotive') {
    return [
      // ===== Engine & Powertrain =====
      { word: 'internal combustion engine', partOfSpeech: 'n.', definition: 'n. 内燃机' },
      { word: 'cylinder', partOfSpeech: 'n.', definition: 'n. 气缸' },
      { word: 'spark plug', partOfSpeech: 'n.', definition: 'n. 火花塞' },
      { word: 'fuel injector', partOfSpeech: 'n.', definition: 'n. 燃油喷射器' },
      { word: 'turbocharger', partOfSpeech: 'n.', definition: 'n. 涡轮增压器' },
      { word: 'transmission', partOfSpeech: 'n.', definition: 'n. 变速箱；传动系统' },
      { word: 'clutch', partOfSpeech: 'n.', definition: 'n. 离合器' },
      { word: 'driveshaft', partOfSpeech: 'n.', definition: 'n. 传动轴' },
      { word: 'differential', partOfSpeech: 'n.', definition: 'n. 差速器' },
      { word: 'axle', partOfSpeech: 'n.', definition: 'n. 车轴' },
      // ===== Electrical & Electronics =====
      { word: 'battery', partOfSpeech: 'n.', definition: 'n. 蓄电池；电瓶' },
      { word: 'alternator', partOfSpeech: 'n.', definition: 'n. 交流发电机' },
      { word: 'starter motor', partOfSpeech: 'n.', definition: 'n. 起动机' },
      { word: 'sensor', partOfSpeech: 'n.', definition: 'n. 传感器' },
      { word: 'ECU', partOfSpeech: 'n.', definition: 'n. 电子控制单元' },
      // ===== Suspension & Brakes =====
      { word: 'suspension', partOfSpeech: 'n.', definition: 'n. 悬挂系统' },
      { word: 'shock absorber', partOfSpeech: 'n.', definition: 'n. 减震器' },
      { word: 'brake pad', partOfSpeech: 'n.', definition: 'n. 刹车片' },
      { word: 'brake disc', partOfSpeech: 'n.', definition: 'n. 刹车盘' },
      { word: 'ABS', partOfSpeech: 'n.', definition: 'n. 防抱死制动系统' },
      // ===== Body & Chassis =====
      { word: 'chassis', partOfSpeech: 'n.', definition: 'n. 底盘' },
      { word: 'fender', partOfSpeech: 'n.', definition: 'n. 挡泥板' },
      { word: 'hood', partOfSpeech: 'n.', definition: 'n. 引擎盖' },
      { word: 'trunk', partOfSpeech: 'n.', definition: 'n. 后备箱' },
      { word: 'grille', partOfSpeech: 'n.', definition: 'n. 进气格栅' },
      { word: 'exhaust pipe', partOfSpeech: 'n.', definition: 'n. 排气管' },
      { word: 'catalytic converter', partOfSpeech: 'n.', definition: 'n. 催化转化器' },
      // ===== EV & New Energy =====
      { word: 'electric vehicle', partOfSpeech: 'n.', definition: 'n. 电动汽车' },
      { word: 'lithium battery', partOfSpeech: 'n.', definition: 'n. 锂电池' },
      { word: 'regenerative braking', partOfSpeech: 'n.', definition: 'n. 再生制动' },
      { word: 'charging station', partOfSpeech: 'n.', definition: 'n. 充电站' },
      { word: 'range', partOfSpeech: 'n.', definition: 'n. 续航里程' },
      { word: 'autonomous driving', partOfSpeech: 'n.', definition: 'n. 自动驾驶' },
      { word: 'ADAS', partOfSpeech: 'n.', definition: 'n. 高级驾驶辅助系统' },
      { word: 'LiDAR', partOfSpeech: 'n.', definition: 'n. 激光雷达' },
      // ===== Maintenance & Service =====
      { word: 'diagnostic', partOfSpeech: 'n./adj.', definition: 'n. 诊断；adj. 诊断的' },
      { word: 'oil change', partOfSpeech: 'n.', definition: 'n. 换机油' },
      { word: 'tire rotation', partOfSpeech: 'n.', definition: 'n. 轮胎换位' },
      { word: 'alignment', partOfSpeech: 'n.', definition: 'n. 四轮定位' },
      { word: 'recall', partOfSpeech: 'n./v.', definition: 'n. 召回；v. 召回（缺陷车辆）' },
    ]
  } else if (theme === 'foreign-trade') {
    return [
      // ===== Trade Basics =====
      { word: 'import', partOfSpeech: 'n./v.', definition: 'n. 进口；v. 进口' },
      { word: 'export', partOfSpeech: 'n./v.', definition: 'n. 出口；v. 出口' },
      { word: 'tariff', partOfSpeech: 'n.', definition: 'n. 关税' },
      { word: 'quota', partOfSpeech: 'n.', definition: 'n. 配额；限额' },
      { word: 'trade deficit', partOfSpeech: 'n.', definition: 'n. 贸易逆差' },
      { word: 'trade surplus', partOfSpeech: 'n.', definition: 'n. 贸易顺差' },
      { word: 'dumping', partOfSpeech: 'n.', definition: 'n. 倾销' },
      { word: 'subsidy', partOfSpeech: 'n.', definition: 'n. 补贴；补助金' },
      // ===== Incoterms & Shipping =====
      { word: 'FOB', partOfSpeech: 'n.', definition: 'n. 船上交货（离岸价）' },
      { word: 'CIF', partOfSpeech: 'n.', definition: 'n. 到岸价（成本+保险+运费）' },
      { word: 'EXW', partOfSpeech: 'n.', definition: 'n. 工厂交货价' },
      { word: 'bill of lading', partOfSpeech: 'n.', definition: 'n. 提单' },
      { word: 'container', partOfSpeech: 'n.', definition: 'n. 集装箱' },
      { word: 'customs clearance', partOfSpeech: 'n.', definition: 'n. 清关' },
      { word: 'freight', partOfSpeech: 'n.', definition: 'n. 货物；运费' },
      // ===== Payment & Finance =====
      { word: 'letter of credit', partOfSpeech: 'n.', definition: 'n. 信用证' },
      { word: 'T/T', partOfSpeech: 'n.', definition: 'n. 电汇（Telegraphic Transfer）' },
      { word: 'insurance', partOfSpeech: 'n.', definition: 'n. 保险' },
      { word: 'currency exchange', partOfSpeech: 'n.', definition: 'n. 货币兑换；汇率' },
      { word: 'deposit', partOfSpeech: 'n.', definition: 'n. 定金；押金' },
      // ===== Business Documents =====
      { word: 'invoice', partOfSpeech: 'n.', definition: 'n. 发票' },
      { word: 'packing list', partOfSpeech: 'n.', definition: 'n. 装箱单' },
      { word: 'certificate of origin', partOfSpeech: 'n.', definition: 'n. 原产地证书' },
      { word: 'proforma invoice', partOfSpeech: 'n.', definition: 'n. 形式发票' },
      // ===== Negotiation & Contracts =====
      { word: 'negotiation', partOfSpeech: 'n.', definition: 'n. 谈判；协商' },
      { word: 'contract', partOfSpeech: 'n.', definition: 'n. 合同' },
      { word: 'breach of contract', partOfSpeech: 'n.', definition: 'n. 违约' },
      { word: 'arbitration', partOfSpeech: 'n.', definition: 'n. 仲裁' },
      { word: 'force majeure', partOfSpeech: 'n.', definition: 'n. 不可抗力' },
      // ===== Sales & Marketing =====
      { word: 'MOQ', partOfSpeech: 'n.', definition: 'n. 最小起订量' },
      { word: 'sample', partOfSpeech: 'n.', definition: 'n. 样品；打样' },
      { word: 'lead time', partOfSpeech: 'n.', definition: 'n. 交货期；前置时间' },
      { word: 'inquiry', partOfSpeech: 'n.', definition: 'n. 询盘；询价' },
      { word: 'quotation', partOfSpeech: 'n.', definition: 'n. 报价单' },
      { word: 'purchase order', partOfSpeech: 'n.', definition: 'n. 采购订单' },
      // ===== Quality & Logistics =====
      { word: 'inspection', partOfSpeech: 'n.', definition: 'n. 检验；验货' },
      { word: 'warehouse', partOfSpeech: 'n.', definition: 'n. 仓库' },
      { word: 'inventory', partOfSpeech: 'n.', definition: 'n. 库存；存货' },
      { word: 'logistics', partOfSpeech: 'n.', definition: 'n. 物流' },
      { word: 'supply chain', partOfSpeech: 'n.', definition: 'n. 供应链' },
      { word: 'distributor', partOfSpeech: 'n.', definition: 'n. 经销商；分销商' },
    ]
  }
  return []
}
const genSystemPrompt = `You are an IELTS vocabulary expert. Generate complete learning data for the given words.

Return ONLY valid JSON — a single array of objects. No other text. Always use " for strings (valid JSON).

Each object format:
{
  "word": "the word",
  "phonetic": "/IPA phonetic/",
  "partOfSpeech": "v./n./adj./adv./prep.",
  "definition": "Chinese definition",
  "collocations": "collocation1 中文1, collocation2 中文2, collocation3 中文3",
  "examples": [
    { "en": "natural IELTS-level example sentence.", "zh": "对应的中文翻译" },
    { "en": "another natural IELTS-level example sentence.", "zh": "对应的中文翻译" }
  ]
}

Rules:
- Phonetic must be accurate IPA enclosed in //
- Part of speech must use Chinese style abbreviations (v., n., adj., adv., prep., conj., pron.)
- Definition must be comprehensive in Chinese
- Collocations must be IELTS-level, each English + Chinese translation separated by space
- 3 example sentences per word, IELTS-level — each covering a different usage or meaning
- ALWAYS output valid JSON — no markdown, no explanation`

async function generateWithDeepSeek(words: string[], systemPrompt?: string): Promise<Record<string, DeepSeekWord>> {
  if (!API_KEY) {
    console.warn('⚠ DEEPSEEK_API_KEY not set — skipping AI generation')
    return {}
  }

  const prompt = systemPrompt || genSystemPrompt
  const result: Record<string, DeepSeekWord> = {}

  for (let i = 0; i < words.length; i += BATCH_SIZE) {
    const batch = words.slice(i, i + BATCH_SIZE)
    console.log(`  Generating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(words.length / BATCH_SIZE)} (${batch.length} words)...`)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT)

      const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: JSON.stringify(batch) },
          ],
          max_tokens: 4096,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`DeepSeek HTTP ${res.status}: ${text.slice(0, 200)}`)
      }

      const data = await res.json()
      const content: string = data.choices?.[0]?.message?.content || ''

      const firstBrace = content.indexOf('[')
      const lastBrace = content.lastIndexOf(']')
      if (firstBrace === -1 || lastBrace <= firstBrace) {
        // Try object with words key
        const objStart = content.indexOf('{')
        const objEnd = content.lastIndexOf('}')
        if (objStart !== -1 && objEnd > objStart) {
          const parsed = JSON.parse(content.slice(objStart, objEnd + 1))
          const arr = parsed.words || parsed.data || parsed.entries || []
          for (const item of arr) {
            result[item.word.toLowerCase()] = item as DeepSeekWord
          }
        }
        continue
      }

      const arr = JSON.parse(content.slice(firstBrace, lastBrace + 1)) as DeepSeekWord[]
      for (const item of arr) {
        result[item.word.toLowerCase()] = item
      }
    } catch (err) {
      console.warn(`  ⚠ Batch failed:`, err instanceof Error ? err.message : err)
    }
  }

  return result
}

// ========== 3b. SCENE WORD GENERATION PROMPT ==========
const genScenePrompt = `You are a vocabulary assistant. For each given word, generate simple learning data.

Return ONLY valid JSON — a single array of objects. No other text. Always use " for strings (valid JSON).

Each object format:
{
  "word": "the word",
  "phonetic": "/IPA phonetic/",
  "partOfSpeech": "n./v./adj./adv.",
  "definition": "Chinese definition",
  "collocations": "collocationPhrase 中文",
  "examples": [
    { "en": "A simple everyday example sentence.", "zh": "对应的中文翻译" }
  ]
}

Rules:
- 1 example sentence per word — simple, everyday, natural
- 1 collocation per word — common phrase
- ALWAYS output valid JSON — no markdown, no explanation`

// ========== 3c. WIKIPEDIA IMAGE FETCH ==========
async function fetchWikipediaImage(word: string): Promise<string | null> {
  const UA = 'EELearningApp/1.0'
  const title = word.charAt(0).toUpperCase() + word.slice(1)

  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': UA } },
    )
    if (res.ok) {
      const data = await res.json()
      if (data?.thumbnail?.source) return data.thumbnail.source
    }
  } catch { /* fallthrough */ }

  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=pageimages&format=json&pithumbsize=400&redirects=1`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': UA } },
    )
    if (searchRes.ok) {
      const data = await searchRes.json()
      const page = Object.values(data?.query?.pages || {})[0] as { thumbnail?: { source: string } } | undefined
      if (page?.thumbnail?.source) return page.thumbnail.source
    }
  } catch { /* fallthrough */ }

  try {
    // Step 3: search for the term and try the top result
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title)}&format=json&srlimit=1`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': UA } },
    )
    if (!searchRes.ok) return null
    const data = await searchRes.json()
    const firstTitle: string | undefined = data?.query?.search?.[0]?.title
    if (!firstTitle) return null

    const imgRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(firstTitle)}&prop=pageimages&format=json&pithumbsize=400`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': UA } },
    )
    if (!imgRes.ok) return null
    const imgData = await imgRes.json()
    const pages = Object.values(imgData?.query?.pages || {})
    const page = pages[0] as { thumbnail?: { source: string } } | undefined
    return page?.thumbnail?.source || null
  } catch {
    return null
  }
}

// ========== 4. EXTRA IELTS WORDS ==========
const EXTRA_WORDS = [
  // A
  'abnormal','abolition','abortion','absence','absent','absolute','absorb','abstract','absurd',
  'abundance','abuse','academic','academy','accelerate','accent','accept','acceptable','acceptance',
  'access','accessible','accident','accommodate','accommodation','accompany','accomplish',
  'accordance','account','accountability','accountant','accumulate','accuracy','accuse',
  'achieve','achievement','acknowledge','acquaintance','acquire','acquisition','activate',
  'activist','acute','adapt','adaptation','addict','addition','additional','address',
  'adequate','adhere','adjacent','adjust','adjustment','administer','administration',
  'administrative','administrator','admire','admission','admit','adolescent','adopt',
  'adoption','advance','advanced','advantage','advent','adverse','advertise','advertisement',
  'advertising','advisable','advocate','aesthetic','affair','affiliate','affirm','affirmative',
  'afford','aftermath','afterward','agenda','agent','aggravate','aggregate','aggressive',
  'agility','agony','agree','agricultural','agriculture','aide','alarming','alert','alien',
  'alienate','align','alignment','allegation','allege','allegedly','allergic','allergy',
  'alleviate','alliance','allocate','allocation','allow','allowance','alloy','ally',
  'alter','alteration','alternate','alternative','altitude','aluminium','amateur','amaze',
  'amazing','ambassador','ambient','ambiguous','ambition','ambitious','ambulance',
  'amend','amendment','amid','amount','ample','amplify','amuse','analogue','analogy',
  'analyse','analysis','analyst','analytic','ancestor','ancestry','anchor','ancient',
  'anecdote','angel','anger','angle','angry','anguish','animate','ankle','anniversary',
  'annotate','announce','announcement','annoy','annoyance','annual','anonymity','anonymous',
  'antarctic','anthropology','antibiotic','anticipate','anticipation','anxiety','anxious',
  'apart','apartment','apathetic','apathy','ape','appal','apparatus','apparent','appeal',
  'appealing','appear','appearance','appease','appendix','appetite','applaud','applause',
  'appliance','applicable','applicant','application','applied','apply','appoint',
  'appointment','appraisal','appreciate','appreciation','apprentice','approach',
  'appropriate','approval','approve','approximate','aquarium','aquatic','arbitrary',
  'arbitration','archive','arctic','arena','argue','argument','arise','arithmetic',
  'arm','army','arouse','arrange','arrangement','array','arrest','arrival','arrive',
  'arrogant','arson','articulate','artifact','artificial','artillery','artwork',
  'ascend','ascertain','ascribe','ashamed','aside','aspect','aspiration','aspire',
  'assassination','assault','assemble','assembly','assert','assertion','assess',
  'assessment','asset','assign','assignment','assist','assistance','assistant',
  'associate','association','assume','assumption','assurance','assure','asthma',
  'astonish','astronaut','astronomy','asylum','athlete','athletic','atlas','atmosphere',
  'atmospheric','atom','atomic','attach','attachment','attain','attainment','attempt',
  'attend','attendance','attendant','attention','attentive','attitude','attorney',
  'attract','attraction','attractive','attributable','attribute','auction','audience',
  'audio','audit','auditor','auditorium','authentic','authenticate','author',
  'authoritarian','authoritative','authority','authorize','automatic','automation',
  'autonomous','autonomy','availability','available','average','aviation','avoid',
  'avoidance','await','award','awareness','awesome','awful','awkward',
  // B
  'bachelor','backdrop','backup','bacteria','badge','baffle','balance','balcony',
  'ballot','ban','band','banking','bankruptcy','banner','barrel','barren','barrier',
  'base','baseline','basement','basin','basis','batch','battery','battle','bay',
  'beacon','beam','bear','beast','behalf','behave','behavior','behavioral','being',
  'belief','bench','benchmark','beneath','beneficial','beneficiary','benefit',
  'besides','betray','beverage','bewilder','bias','biased','bible','bicycle',
  'bid','bilateral','bilingual','bill','bind','binoculars','bio','biography',
  'biological','biologist','biology','biomedical','biotechnology','bizarre','blade',
  'blame','blank','blast','blaze','bleed','blend','bless','blind','block','blog',
  'bloom','blossom','blueprint','blunder','blur','board','boast','bold','bolster',
  'bomb','bond','bonus','boom','boost','border','boredom','botanical','botany',
  'bother','bottom','bounce','bound','boundary','bounty','bourgeois','boutique',
  'boycott','brace','bracket','brain','brainstorm','brake','branch','brand','breach',
  'breakdown','breakthrough','breed','breeze','brew','bribe','bribery','brick',
  'bride','bridge','brief','brilliant','brink','broad','broadband','broadcast',
  'broadcaster','broaden','brochure','bronze','browse','bruise','brutal','bubble',
  'bucket','budget','buffer','bug','build','bulk','bullet','bulletin','bully',
  'bump','bunch','bundle','burden','bureau','bureaucracy','bureaucrat','burial',
  'burst','businessman','bust','butterfly','bypass',
  // C
  'cabinet','cable','calcium','calculate','calculation','calculator','calendar',
  'calibrate','calorie','campaign','campus','canal','cancel','cancellation',
  'candidate','capability','capable','capacity','cape','capital','capitalism',
  'capitalist','capsule','captain','caption','captive','captivity','capture',
  'carbon','carcass','cardiac','career','careful','cargo','carnival','carpenter',
  'carriage','carrier','cart','cartel','cartoon','carve','cascade','case','cash',
  'cashier','cassette','cast','castle','casual','casualty','catalog','catalogue',
  'catastrophe','catch','categorical','categorize','category','cater','catering',
  'catholic','cattle','caution','cautious','cave','cease','celebrate','celebration',
  'celebrity','cell','cellar','census','centenary','centimeter','central','centralize',
  'ceramic','cereal','ceremony','certainty','certificate','certify','challenge',
  'challenging','chamber','champion','championship','chancellor','chaos','chaotic',
  'chapter','character','characteristic','characterize','charge','charity','charm',
  'chart','charter','chase','cheat','checkpoint','chemical','chemist','cherish',
  'chess','chew','chief','childbirth','childhood','chill','chimney','chip','chlorine',
  'chocolate','cholera','chore','chorus','chronic','chronicle','chunk','circuit',
  'circular','circulate','circulation','circumference','circumstance','circus',
  'cite','citizen','citizenship','civic','civil','civilian','civilization',
  'civilize','claim','clamp','clan','clash','class','classic','classical',
  'classification','classify','classroom','clause','clay','cleanse','clearance',
  'client','clientele','cliff','climax','climb','clinic','clinical','clip',
  'cloak','clone','closure','cluster','clutch','coal','coalition','coarse','coast',
  'coastal','code','cognitive','coherent','cohesion','coincide','coincidence',
  'collaborate','collaboration','collapse','colleague','collect','collection',
  'collective','collector','college','collide','collision','colonial','colonize',
  'colony','column','combat','combination','combine','combustion','comedy',
  'comet','comfort','comfortable','comic','command','commander','commemorate',
  'commence','commencement','commend','comment','commentary','commentator',
  'commerce','commercial','commission','commissioner','commit','commitment',
  'committee','commodity','commonplace','communal','communicate','communication',
  'communicative','communism','communist','community','commute','commuter',
  'compact','companion','company','comparable','comparative','compare','comparison',
  'compartment','compass','compassion','compassionate','compatible','compel',
  'compelling','compensate','compensation','compete','competence','competent',
  'competition','competitive','competitor','compile','complacent','complain',
  'complaint','complement','complementary','completion','complex','complexion',
  'complexity','compliance','complicate','complicated','complication','compliment',
  'comply','component','compose','composer','composite','composition','compound',
  'comprehend','comprehension','comprehensive','compress','comprise','compromise',
  'compulsory','compute','computer','conceal','concede','conceive','concentrate',
  'concentration','concept','conception','concern','concerning','concert',
  'concession','concise','conclude','conclusion','conclusive','concrete','condemn',
  'condensation','condense','condition','conditional','conduct','conductor',
  'confer','conference','confess','confession','confide','confidence','confident',
  'confidential','configuration','confine','confinement','confirm','confirmation',
  'confiscate','conflict','conform','conformity','confront','confrontation',
  'confuse','confusion','congestion','congratulate','congratulation','congregate',
  'congregation','congress','congressional','conjunction','connect','connection',
  'connotation','conscience','conscientious','conscious','consciousness','consecutive',
  'consensus','consent','consequence','consequent','consequently','conservation',
  'conservationist','conservative','conserve','consider','considerable','considerate',
  'consideration','consign','consignment','consist','consistency','consistent',
  'consolation','console','consolidate','consolidation','conspicuous','conspiracy',
  'conspire','constant','constantly','constituency','constituent','constitute',
  'constitution','constitutional','constrain','constraint','construct','construction',
  'constructive','consult','consultant','consultation','consume','consumer',
  'consumption','contact','contain','container','contaminant','contaminate',
  'contamination','contemplate','contemporary','contempt','contend','contender',
  'content','contented','contention','contest','contestant','context','continent',
  'continental','contingency','continual','continuation','continue','continuity',
  'continuous','contract','contractor','contradict','contradiction','contradictory',
  'contrary','contrast','contribute','contribution','contributor','contrive',
  'control','controversial','controversy','convene','convenience','convenient',
  'convention','conventional','convergence','conversation','converse','conversion',
  'convert','convey','convict','conviction','convince','convincing','cook','cookie',
  'cooperate','cooperation','cooperative','coordinate','coordination','coordinator',
  'cope','copyright','cord','cordial','core','cornerstone','corporate','corporation',
  'corps','corpse','correct','correction','correlate','correlation','correspond',
  'correspondence','correspondent','corridor','corrode','corrosion','corrupt',
  'corruption','cosmetic','cosmic','cosmopolitan','costly','costume','cottage',
  'council','councilor','counsel','counselling','counsellor','counter','counteract',
  'counterpart','countless','coup','couple','coupon','courage','courageous','course',
  'courtesy','coverage','covert','crack','cradle','craft','craftsman','crash',
  'crawl','create','creation','creative','creativity','creator','creature',
  'credential','credibility','credible','credit','creditor','creek','creep',
  'crew','crime','criminal','criminology','cripple','crisis','criterion','critic',
  'critical','criticism','criticize','critique','crop','cross','crossing',
  'crucial','crude','cruel','cruelty','cruise','crumble','crunch','crush','crust',
  'crystal','cube','cubic','cuisine','culminate','culprit','cultivate','cultivation',
  'cultural','culture','cumulative','cunning','cupboard','curator','curb','cure',
  'curiosity','curious','currency','current','curriculum','curse','curtail',
  'curtain','curve','cushion','custody','custom','customary','customer','cut',
  'cyber','cycle','cyclic','cycling','cyclist','cylinder','cynical',
  // D
  'dairy','dam','damage','damaging','damp','dare','daring','database','dawn',
  'daylight','dazzle','deadline','deadly','dealer','dear','debate','debris','debt',
  'debtor','debut','decade','decay','deceit','deceive','decelerate','decent',
  'deception','deceptive','decide','decimal','decision','decisive','deck',
  'declaration','declare','decline','decode','decompose','decorate','decoration',
  'decorative','decrease','decree','dedicate','dedication','deduce','deduct',
  'deduction','deem','deepen','default','defeat','defect','defence','defend',
  'defendant','defender','defensive','defer','deficiency','deficit','define',
  'definite','definitely','definition','definitive','deflate','deflect','deforest',
  'deforestation','deform','defraud','defy','degenerate','degradation','degrade',
  'degree','delay','delegate','delegation','delete','deliberate','deliberately',
  'delicacy','delicate','delicious','delight','delightful','deliver','delivery',
  'delusion','demand','demanding','demarcation','democracy','democrat','democratic',
  'demographic','demolish','demonstrate','demonstration','demonstrator','demoralize',
  'denial','denote','denounce','dense','density','dental','dentist','deny','depart',
  'department','departure','depend','dependence','dependency','dependent','depict',
  'depiction','deplete','depletion','deplore','deploy','deployment','depopulation',
  'deport','deposit','deposition','depreciate','depreciation','depress','depressed',
  'depressing','depression','deprivation','deprive','deprived','deputy','derivative',
  'derive','descend','descendant','descent','describe','description','descriptive',
  'desert','deserve','design','designate','designation','desirable','desire',
  'desktop','desolate','despair','desperate','desperation','despise','despite',
  'destination','destine','destiny','destroy','destruction','destructive','detach',
  'detachment','detail','detain','detect','detection','detective','detention',
  'deter','detergent','deteriorate','deterioration','determination','determine',
  'determined','deterrent','detrimental','devastate','devastating','devastation',
  'develop','developer','development','developmental','deviate','deviation',
  'device','devil','devise','devote','devoted','devotion','diagnose','diagnosis',
  'diagnostic','diagram','dial','dialect','dialog','diameter','diamond','diary',
  'dictate','dictator','diet','dietary','differ','difference','different',
  'differential','differentiate','difficulty','diffuse','diffusion','digest',
  'digestion','digestive','digital','dignity','dilemma','diligence','diligent',
  'dilute','dimension','diminish','dine','dining','diploma','diplomacy','diplomat',
  'diplomatic','directory','disability','disable','disabled','disadvantage',
  'disadvantaged','disagree','disagreement','disappear','disappearance',
  'disappoint','disappointed','disappointing','disappointment','disapproval',
  'disapprove','disarm','disaster','disastrous','disburse','discard','discern',
  'discharge','discipline','disclose','disclosure','disco','discomfort',
  'disconnect','discount','discourage','discourse','discover','discovery',
  'discredit','discrepancy','discretion','discriminate','discrimination',
  'discriminatory','discuss','discussion','disdain','disease','disgrace','disguise',
  'disgust','dishonest','dishonesty','disillusion','disinfect','disk','dislike',
  'dismal','dismantle','dismay','dismiss','dismissal','disorder','dispatch',
  'dispel','dispensable','dispensary','dispensation','dispense','disperse',
  'displace','displacement','display','disposal','dispose','disposition',
  'disproportionate','dispute','disqualify','disregard','disrespect','disrupt',
  'disruption','disruptive','dissatisfaction','dissatisfied','disseminate',
  'dissemination','dissent','dissertation','dissolve','distance','distant',
  'distil','distillation','distinct','distinction','distinctive','distinguish',
  'distort','distortion','distract','distraction','distress','distribute',
  'distribution','distributor','district','distrust','disturb','disturbance',
  'diverse','diversification','diversify','diversion','diversity','divert',
  'divide','dividend','divine','division','divorce','dizzy','dock','doctorate',
  'doctrine','document','documentary','documentation','dodge','domain','dome',
  'domestic','dominance','dominant','dominate','domination','donate','donation',
  'donor','doom','doorway','dosage','dose','doubt','doubtful','doubtless',
  'downfall','downgrade','download','downplay','downside','downturn','draft',
  'drag','drain','drainage','drama','dramatic','dramatically','drastic','drawback',
  'dread','dreadful','dream','drift','drill','drought','drown','drowsy','drunk',
  'dual','dubious','duck','due','dumb','dump','duplicate','duplication',
  'durability','durable','duration','dusk','duty','dwarf','dwell','dwelling',
  'dwindle','dynamic','dynamics','dynasty',
  // E
  'eager','earn','earnest','earthquake','ease','eastern','eccentric','echo',
  'eclipse','ecological','ecologist','ecology','e-commerce','economic','economical',
  'economics','economist','economy','ecosystem','edge','edible','edit','edition',
  'editor','editorial','educate','educated','education','educational','educator',
  'effect','effective','effectiveness','efficiency','efficient','effort','eject',
  'elaborate','elastic','elasticity','elbow','elderly','elect','election',
  'electoral','electric','electrical','electrician','electricity','electromagnetic',
  'electron','electronic','electronics','elegant','element','elementary','elephant',
  'elevate','elevation','elevator','elicit','eligible','eligibility','eliminate',
  'elimination','elite','eloquent','elsewhere','elusive','email','emancipate',
  'embargo','embark','embarrass','embarrassment','embassy','embed','emblem',
  'embody','embrace','embryo','emerge','emergence','emergency','emigrant',
  'emigrate','emigration','eminent','emission','emit','emotion','emotional',
  'emotive','empathy','emperor','emphasis','emphasize','empire','empirical',
  'employ','employee','employer','employment','empower','empowerment','empty',
  'emulate','enable','enact','enactment','enamel','enchant','enclose','enclosure',
  'encompass','encounter','encourage','encouragement','encroach','encyclopedia',
  'endanger','endeavor','endemic','endless','endorse','endorsement','endow',
  'endowment','endurance','endure','enforce','enforcement','engage','engagement',
  'engaging','engine','engineer','engineering','engrave','enhance','enhancement',
  'enjoy','enjoyable','enjoyment','enlarge','enlargement','enlighten','enlightenment',
  'enlist','enormous','enrich','enrichment','enrol','enrollment','ensemble',
  'ensue','ensure','enterprise','entertain','entertainer','entertainment',
  'enthusiasm','enthusiast','enthusiastic','entire','entirely','entitle',
  'entitlement','entity','entrance','entrepreneur','entrepreneurial','entry',
  'envelope','environment','environmental','environmentalist','envisage','envision',
  'epidemic','episode','epistemic','epoch','equal','equality','equally','equation',
  'equator','equilibrium','equip','equipment','equitable','equity','equivalent',
  'era','eradicate','erase','erect','erosion','erratic','error','erupt','eruption',
  'escalate','escalation','escape','escort','especially','essay','essence',
  'essential','establish','establishment','estate','esteem','estimate','estimation',
  'etc','eternal','ethical','ethics','ethnic','etiquette','evacuate','evacuation',
  'evade','evaluate','evaluation','evaporate','evaporation','even','event',
  'eventual','eventually','ever','everyday','evidence','evident','evil','evoke',
  'evolution','evolutionary','evolve','exact','exactly','exaggerate','exaggeration',
  'examination','examine','examiner','example','exceed','exceedingly','excel',
  'excellence','excellent','exception','exceptional','excerpt','excess','excessive',
  'exchange','excite','excitement','exciting','exclaim','exclamation','exclude',
  'exclusion','exclusive','excursion','excuse','execute','execution','executive',
  'exemplary','exemplify','exempt','exemption','exercise','exert','exertion',
  'exhaust','exhausted','exhaustion','exhaustive','exhibit','exhibition','exile',
  'exist','existence','existent','existential','exit','exotic','expand','expanse',
  'expansion','expansive','expect','expectancy','expectation','expedition','expel',
  'expend','expenditure','expense','expensive','expert','expertise','expiration',
  'expire','explain','explanation','explanatory','explicit','explode','exploit',
  'exploitation','exploration','exploratory','explore','explorer','explosion',
  'explosive','export','exporter','expose','exposition','exposure','express',
  'expression','expressive','expropriate','expulsion','exquisite','extend',
  'extension','extensive','extent','exterior','external','extinct','extinction',
  'extinguish','extra','extract','extraction','extraordinary','extrapolate',
  'extravagant','extreme','extremely','extremist','extricate','exuberant','eyebrow',
  // F
  'fabric','fabricate','fabulous','facade','facilitate','facility','faction',
  'factor','factory','factual','faculty','fade','fail','failure','faint','fair',
  'fairly','fairness','fairy','faith','faithful','fake','fame','familiar',
  'famine','fan','fancy','fantastic','fantasy','fare','farewell','fascinate',
  'fascinating','fascination','fashion','fashionable','fasten','fatal','fatality',
  'fate','father','fatigue','fault','faulty','favor','favorable','favored',
  'favorite','fax','fear','fearful','feasibility','feasible','feast','feat',
  'feature','federal','federation','fee','feedback','female','feminine','feminism',
  'feminist','fence','ferry','fertile','fertility','fertilizer','festival',
  'fetch','fever','fiber','fiction','fictional','fierce','fiery','fig','figure',
  'file','fill','filter','filth','final','finale','finalize','finance','financial',
  'financier','finding','fingerprint','finite','firefighter','firewall','firm',
  'fiscal','fisherman','fishery','fitness','fixture','flag','flame','flare',
  'flash','flavor','flaw','flawed','flee','fleet','flesh','flexibility','flexible',
  'flick','flight','fling','flip','float','flock','flood','flourish','flow',
  'fluctuate','fluctuation','fluency','fluent','fluid','flush','flutter','focus',
  'fog','foil','fold','folk','folklore','footnote','footprint','forbid',
  'forbidden','force','forceful','forecast','foreground','foremost','forerunner',
  'foresee','foreseeable','forestry','foretell','forever','forfeit','forge',
  'forgery','forgive','forgiveness','fork','form','formal','formality','format',
  'formation','formative','former','formidable','formula','formulate','formulation',
  'forsake','forth','forthcoming','fortify','fortnight','fortunate','fortune',
  'forum','forward','fossil','foster','foul','foundation','founder','fountain',
  'fraction','fracture','fragile','fragment','fragrance','framework','franchise',
  'frank','fraud','fraudulent','fray','free','freedom','freeway','freeze',
  'freight','frequency','frequent','fresh','freshman','friction','fridge','friend',
  'friendly','friendship','frighten','fringe','frog','frontier','frost','frown',
  'fruit','fruitful','frustrate','frustrated','frustrating','frustration',
  'fuel','fulfill','fulfillment','function','functional','fund','fundamental',
  'fundamentally','funding','fundraiser','funeral','fungus','funnel','fur',
  'furious','furnace','furnish','furniture','further','furthermore','furthest',
  'fury','fuse','fusion','fuss','futile','future','fuzzy',
  // G
  'gain','galaxy','gallery','gallon','gambling','gap','garage','garbage','garden',
  'garment','gasoline','gasp','gather','gathering','gauge','gaze','gear','gender',
  'gene','general','generalization','generalize','generate','generation',
  'generator','generic','generosity','generous','genetic','genetics','genius',
  'genocide','genre','gentle','genuine','genuinely','geographic','geographical',
  'geography','geological','geology','geometry','germ','gesture','giant','gift',
  'gigantic','gist','glacier','glamour','glance','gland','glare','glass','gleam',
  'glide','glimpse','global','globalization','globe','gloom','gloomy','glory',
  'glossary','glow','glucose','goal','golden','goodness','goodwill','gorgeous',
  'gossip','govern','governance','government','governor','grab','grace','graceful',
  'gracious','grade','gradual','gradually','graduate','graduation','grain',
  'grand','grandeur','grandparent','grant','graph','graphic','graphics','grasp',
  'grassroots','grateful','gratitude','grave','gravity','grazing','grease',
  'great','greatly','greed','greedy','green','greenhouse','greet','greeting',
  'grief','grievance','grieve','grill','grind','grip','grocery','gross','ground',
  'groundbreaking','groundwater','grove','grow','growth','guarantee','guard',
  'guardian','guerrilla','guess','guidance','guide','guideline','guilt','guilty',
  'guitar','gulf','gun','gust','gut','gutter','gym','gymnastics','gypsy',
  // H
  'habitat','hack','hacker','hall','halt','hamper','handbook','handful',
  'handicap','handicapped','handle','handling','handwriting','handy','harassment',
  'harbor','hard','harden','hardly','hardware','hardy','harm','harmful','harmless',
  'harmonic','harmony','harness','harsh','harvest','hassle','haste','hasty',
  'hatch','haul','haunt','haven','havoc','hazard','hazardous','haze','head',
  'headache','heading','headline','headquarters','heal','health','healthcare',
  'healthy','heap','hearing','heart','hearth','heating','heaven','heavily',
  'heavy','hectare','hectic','hedge','heed','height','heighten','heir','helicopter',
  'hell','helmet','helpful','hemisphere','herald','herb','herd','hereditary',
  'heritage','hero','heroic','hesitate','hesitation','hidden','hide','hierarchy',
  'highlight','highly','highway','hike','hiking','hill','hinder','hindrance',
  'hint','hip','historian','historic','historical','history','hit','hitherto',
  'hobby','hoist','holder','holistic','hollow','homage','home','homeland',
  'homeless','homework','homogeneous','honest','honesty','honey','honor',
  'honorable','hook','hope','hopeful','horizon','horizontal','hormone','horn',
  'horrible','horror','horsepower','hose','hospital','hospitality','host',
  'hostage','hostel','hostile','hostility','hot','hotel','household','housing',
  'hover','hub','huddle','human','humane','humanitarian','humanity','humanities',
  'humble','humid','humidity','humiliate','humiliation','humor','humorous',
  'hunger','hunt','hunter','hunting','hurricane','husband','hybrid','hygiene',
  'hymn','hypothesis','hypothesize','hypothetical','hysterical',
  // I
  'ice','icon','idea','ideal','identical','identification','identify','identity',
  'ideological','ideology','idiom','idiot','idle','ignite','ignorance','ignorant',
  'ignore','illegal','illegality','illegible','illicit','illness','illogical',
  'illuminate','illumination','illusion','illustrate','illustration','illustrious',
  'image','imagery','imaginary','imagination','imaginative','imagine','imitate',
  'imitation','immediate','immense','immerse','immersion','immigrant','immigrate',
  'immigration','imminent','immoral','immortal','immune','immunity','immunization',
  'impact','impair','impart','impartial','impatience','impatient','impeachment',
  'impede','impending','imperative','imperfect','imperial','impetus','implement',
  'implementation','implicate','implication','implicit','implore','imply','import',
  'importance','important','impose','imposition','impossibility','impossible',
  'impoverish','impractical','impress','impression','impressive','imprison',
  'imprisonment','improper','improve','improvement','impulse','inability',
  'inaccessible','inaccurate','inadequacy','inadequate','inappropriate',
  'inaugurate','inauguration','incapable','incarcerate','incarnation','incentive',
  'inception','incessant','incidence','incident','incidentally','inclination',
  'incline','include','inclusion','inclusive','income','incoming','incompatible',
  'incompetent','incomplete','incomprehensible','inconceivable','inconclusive',
  'incongruous','inconsistency','inconsistent','inconvenience','inconvenient',
  'incorporate','incorporation','incorrect','increase','increasingly','incredible',
  'increment','incremental','incubate','incubation','incur','indebted','indecent',
  'indeed','indefinite','indefinitely','independence','independent','indeterminate',
  'index','indicate','indication','indicative','indicator','indict','indictment',
  'indifferent','indigenous','indignant','indignation','indirect','indispensable',
  'individual','individuality','indoor','induce','inducement','indulge',
  'indulgence','industrial','industrialization','industrialize','industrious',
  'industry','ineffective','inefficiency','inefficient','inequality','inertia',
  'inevitable','inevitably','inexpensive','inexperience','infant','infantile',
  'infantry','infect','infection','infectious','infer','inference','inferior',
  'inferiority','infinite','infinitely','inflation','inflict','inflow','influence',
  'influential','influenza','influx','inform','informal','information','informative',
  'infrared','infrastructure','infringe','infringement','ingenious','ingenuity',
  'ingredient','inhabit','inhabitant','inhalation','inhale','inherent',
  'inherit','inheritance','inhibit','inhibition','initial','initially','initiate',
  'initiation','initiative','inject','injection','injure','injury','injustice',
  'ink','innate','inner','innocence','innocent','innovation','innovative',
  'innumerable','input','inquest','inquiry','insane','inscription','insect',
  'insecticide','insecure','insecurity','insensitive','insert','insertion',
  'insight','insightful','insignificant','insist','insistence','insistent',
  'inspect','inspection','inspector','inspiration','inspire','inspiring',
  'instability','install','installation','installment','instance','instant',
  'instantaneous','instantly','instead','instinct','instinctive','institute',
  'institution','institutional','instruct','instruction','instructive','instructor',
  'instrument','instrumental','insufficient','insulate','insulation','insulin',
  'insult','insurance','insure','insurgent','intact','intake','integral',
  'integrate','integration','integrity','intellectual','intelligence','intelligent',
  'intelligible','intend','intense','intensify','intensity','intensive','intent',
  'intention','intentional','interact','interaction','interactive','intercept',
  'interception','interchange','intercourse','interest','interested','interesting',
  'interface','interfere','interference','interim','interior','intermediate',
  'intermittent','internal','international','interpret','interpretation',
  'interpreter','interrelated','interrogate','interrogation','interrupt',
  'interruption','intersection','interval','intervene','intervention','interview',
  'interviewee','interviewer','intimate','intimacy','intimidate','intimidation',
  'intolerance','intolerant','intricate','intrigue','intriguing','intrinsic',
  'introduce','introduction','introductory','intrude','intruder','intrusion',
  'intuition','intuitive','invade','invader','invasion','invent','invention',
  'inventive','inventor','inventory','invert','invest','investigate',
  'investigation','investigative','investigator','investment','investor','invisible',
  'invitation','invite','inviting','invoice','involuntary','involve','involved',
  'involvement','ironic','irony','irrational','irregular','irregularity',
  'irrelevant','irreparable','irresistible','irrespective','irresponsible',
  'irrigation','irritate','irritation','isolate','isolated','isolation','issue',
  'item','itinerary',
  // J
  'jargon','jealous','jealousy','jeans','jeopardize','jeopardy','jerk','jet',
  'jewel','jewelry','job','jog','join','joint','joke','journal','journalism',
  'journalist','journey','joy','judge','judgement','judgment','judicial','judiciary',
  'juggle','juice','junction','jungle','junior','junk','jurisdiction','jury',
  'just','justice','justifiable','justification','justify','juvenile',
  // K
  'keen','kernel','key','keyboard','kick','kid','kidnap','kidney','kill','killer',
  'kilogram','kilometer','kindergarten','kindness','kit','kitchen','knee',
  'knock','knot','knowledge','knowledgeable',
  // L
  'label','laboratory','laborious','lack','ladder','lag','lamb','lame','lament',
  'landfill','landing','landlord','landmark','landscape','lane','lantern','lap',
  'lapse','laptop','large','largely','laser','lash','last','late','latent',
  'later','lateral','latest','latitude','latter','laugh','laughter','launch',
  'laundry','lavish','law','lawful','lawn','lawsuit','lawyer','lay','layer',
  'layout','lazy','lead','leader','leadership','leading','leaf','leaflet',
  'league','leak','lean','leap','learn','learned','learning','lease','least',
  'leather','leave','lecture','lecturer','legacy','legal','legend','legislation',
  'legislative','legislator','legislature','legitimacy','legitimate','leisure',
  'lemon','lend','length','lengthen','lenient','lens','lesson','lethal','letter',
  'level','leverage','levy','liability','liable','liaison','liberal','liberalism',
  'liberate','liberation','liberty','library','licence','license','lid',
  'lieutenant','lifelong','lifestyle','lifetime','lift','light','lighten',
  'likelihood','likely','likewise','limb','lime','limit','limitation','limited',
  'limp','line','linear','linen','linger','linguistic','linguistics','link',
  'lion','lip','liquid','liquor','list','listen','listener','literal','literally',
  'literary','literate','literature','litigation','litre','litter','live',
  'livelihood','lively','liver','livestock','living','load','loaf','loan','lobby',
  'local','locality','locate','location','lock','locomotive','lodge','lodging',
  'lofty','log','logic','logical','longitude','lookout','loop','loose','loosen',
  'lord','lorry','lose','loss','lost','lot','lottery','loud','lounge','love',
  'lovely','lover','low','lower','loyal','loyalty','lubricate','luck','lucky',
  'luggage','lukewarm','luminous','lump','lunch','lung','lure','luxury',
  // M
  'machine','machinery','macro','mad','magazine','magic','magistrate','magnet',
  'magnetic','magnetism','magnificent','magnify','magnitude','maid','maiden',
  'mail','main','mainland','mainly','mainstream','maintain','maintenance','major',
  'majority','makeup','male','malfunction','malice','mall','malnutrition',
  'malpractice','mammal','manage','manageable','management','manager','managerial',
  'mandate','mandatory','maneuver','manifest','manifestation','manipulate',
  'manipulation','mankind','manner','mansion','manual','manufacture','manufacturer',
  'manuscript','maple','marathon','marble','march','mare','margin','marginal',
  'marine','marital','maritime','mark','marked','marker','market','marketing',
  'marketplace','marriage','married','marrow','marshal','martial','marvel',
  'marvelous','masculine','mask','mass','massacre','massage','massive','master',
  'masterpiece','mat','match','mate','material','maternal','mathematical',
  'mathematician','mathematics','matter','mature','maturity','maximize','maximum',
  'mayor','maze','meadow','meal','mean','meaning','meaningful','means','meantime',
  'meanwhile','measure','measurement','meat','mechanic','mechanical','mechanism',
  'medal','media','median','mediate','mediation','mediator','medical','medication',
  'medicine','medieval','meditation','medium','meet','melancholy','melody','melt',
  'member','membership','membrane','memo','memoir','memorable','memorandum',
  'memorial','memorize','memory','menace','mend','mental','mentality','mention',
  'mentor','menu','merchandise','merchant','merciful','mercury','mercy','mere',
  'merely','merge','merger','merit','merry','mesh','mess','message','messy',
  'metabolic','metabolism','metal','metaphor','metaphorical','meteor','meteorology',
  'meter','method','methodical','methodology','meticulous','metric','metropolitan',
  'micro','microbe','microphone','microscope','microwave','midday','middle',
  'midnight','midst','migrate','migration','mild','mile','milestone','militant',
  'military','militia','mill','millennium','millimeter','million','millionaire',
  'mimic','mince','mind','mineral','mingle','miniature','minimal','minimize',
  'minimum','mining','minister','ministry','minor','minority','mint','minus',
  'minute','miracle','mirror','miscarriage','miscellaneous','mischief','misconduct',
  'miserable','misery','misfortune','misgiving','misguide','misguided','mislead',
  'misleading','missile','missing','mission','missionary','mist','mistake',
  'mistaken','mistress','misunderstand','misunderstanding','mix','mixed','mixture',
  'moan','mobile','mobility','mobilization','mobilize','mock','mode','model',
  'moderate','moderation','modern','modernization','modernize','modest','modesty',
  'modification','modify','module','moist','moisture','mold','molecule','moment',
  'momentous','momentum','monarch','monarchy','monetary','monitor','monk',
  'monopoly','monotonous','monster','monthly','monument','mood','moon','moral',
  'morale','morality','moreover','mortal','mortality','mortgage','mosaic',
  'mosquito','moss','motel','motion','motivate','motivation','motive','motor',
  'motorway','motto','mound','mount','mountain','mourn','mouse','mouth','move',
  'movement','movie','much','mud','multi','multiple','multiply','multitude',
  'mumble','municipal','municipality','murder','murderer','murmur','muscle',
  'muscular','museum','mushroom','musical','musician','muster','mutation','mute',
  'mutual','mutually','mysterious','mystery','myth','mythology',
  // N
  'nail','naive','naked','namely','nap','narrative','narrow','nasty','nation',
  'national','nationalism','nationalist','nationality','nationwide','native',
  'natural','naturally','nature','naval','navigation','navy','nearby','neat',
  'necessarily','necessary','necessitate','necessity','necklace','negative',
  'neglect','negligence','negligent','negligible','negotiate','negotiation',
  'negotiator','neighborhood','neighbor','neither','nerve','nervous','nest',
  'net','network','neutral','nevertheless','next','nice','niche','nightmare',
  'nil','noble','nobody','nod','noise','noisy','nominal','nominate','nomination',
  'nominee','none','nonetheless','nonsense','norm','normal','normally','normative',
  'north','northeast','northern','northwest','nose','nostalgia','nostalgic',
  'notable','notably','notebook','noteworthy','notice','noticeable','notification',
  'notify','notion','notorious','nourish','nourishment','novel','novelist',
  'novelty','nowadays','nowhere','nuclear','nucleus','nuisance','number',
  'numerical','numerous','nurse','nursery','nurture','nutrient','nutrition',
  'nutritional','nutritious','nylon',
  // O
  'oak','oath','obedience','obedient','obese','obesity','obey','object',
  'objection','objective','obligation','oblige','obliged','obscure','observable',
  'observance','observation','observatory','observe','observer','obsess','obsession',
  'obsessive','obsolete','obstacle','obstruct','obstruction','obtain','obvious',
  'occasion','occasional','occupancy','occupant','occupation','occupational',
  'occupy','occur','occurrence','ocean','odd','odds','odor','offence','offend',
  'offender','offense','offensive','offer','offering','office','officer',
  'official','offspring','oil','omit','ongoing','online','onset','onto',
  'opaque','open','opening','openly','opera','operate','operation','operational',
  'operative','operator','opinion','opponent','opportunity','oppose','opposite',
  'opposition','opt','optical','optimism','optimist','optimistic','optimum',
  'option','optional','oral','orbit','orchestra','ordeal','order','orderly',
  'ordinarily','ordinary','ore','organ','organic','organism','organization',
  'organizational','organize','organized','organizer','orient','orientation',
  'origin','original','originality','originate','ornament','orphan','orthodox',
  'other','otherwise','ought','ounce','outbreak','outcome','outdoor','outdoors',
  'outer','outfit','outgoing','outing','outlet','outline','outlook','output',
  'outrage','outrageous','outright','outset','outside','outskirts','outstanding',
  'outward','oval','oven','overall','overcome','overcrowding','overdue','overflow',
  'overhaul','overhead','overhear','overlap','overload','overlook','overnight',
  'override','overseas','oversee','oversight','overstate','overt','overtake',
  'overthrow','overtime','overturn','overview','overwhelm','overwhelming','owe',
  'own','owner','ownership','oxide','oxygen','ozone',
  // P
  'pace','pack','package','packet','pact','pad','paddle','page','pain','painful',
  'painless','painstaking','paint','painter','painting','pair','palace','pale',
  'palm','pamphlet','pan','panel','panic','panorama','paper','parachute','parade',
  'paradigm','paradise','paradox','paragraph','parallel','paralysis','paralyze',
  'parameter','paramount','parcel','pardon','parental','parish','park','parliament',
  'parliamentary','parody','part','partial','partially','participant','participate',
  'participation','particle','particular','particularly','parting','partisan',
  'partition','partly','partner','partnership','part-time','party','passage',
  'passenger','passion','passionate','passive','passport','password','past',
  'paste','pastime','pasture','pat','patch','patent','path','pathology',
  'pathway','patience','patient','patrol','patron','patronage','pattern',
  'pause','pave','pavement','paw','payment','peak','peasant','peculiar','pedal',
  'pedestrian','pedigree','peer','penalty','pending','penetrate','penetration',
  'pension','pensioner','people','pepper','per','perceive','percent','percentage',
  'perception','perceptive','perfect','perfection','perform','performance',
  'performer','perfume','perhaps','peril','perimeter','period','periodic',
  'periodical','peripheral','perish','permanent','permeable','permission',
  'permit','perpetual','perplex','persecute','persecution','persist','persistence',
  'persistent','person','personal','personality','personalize','personally',
  'personnel','perspective','persuade','persuasion','persuasive','pertain',
  'pertinent','pervasive','pessimism','pessimist','pessimistic','pest','petition',
  'petrol','petroleum','petty','pharmaceutical','pharmacy','phase','phenomenon',
  'philosopher','philosophical','philosophy','phone','photo','photograph',
  'photographer','photography','phrase','physical','physician','physicist',
  'physics','physiological','physiology','piano','pick','picture','picturesque',
  'piece','pierce','pile','pill','pillar','pillow','pilot','pin','pinch','pine',
  'pioneer','pipeline','pirate','pit','pitch','pitfall','pizza','place',
  'placement','plain','plan','plane','planet','planning','plant','plantation',
  'plaster','plastic','plate','plateau','platform','plausible','playground',
  'plea','plead','pleasant','please','pleasure','pledge','plentiful','plenty',
  'plight','plot','plow','plug','plumber','plunge','plural','plus','pocket',
  'poem','poet','poetic','poetry','poignant','point','pointer','poison',
  'poisonous','polar','pole','police','policeman','policy','polish','polite',
  'political','politician','politics','poll','pollutant','pollute','pollution',
  'pond','ponder','pool','pop','popcorn','popular','popularity','populate',
  'population','porcelain','porch','pork','port','portable','portal','portfolio',
  'portion','portrait','portray','portrayal','pose','position','positive',
  'possess','possession','possibility','possible','possibly','post','postage',
  'postal','poster','postgraduate','postpone','postponement','posture','potato',
  'potency','potent','potential','pottery','poultry','poverty','powder','power',
  'powerful','practical','practically','practice','practitioner','prairie',
  'praise','pray','prayer','precaution','precede','precedence','precedent',
  'precious','precipitate','precise','precision','preclude','predator',
  'predecessor','predicate','predict','predictable','prediction','predominant',
  'preface','prefer','preferable','preference','prefix','pregnancy','pregnant',
  'prehistoric','prejudice','preliminary','prelude','premier','premise','premium',
  'preoccupation','preoccupy','preparation','prepare','prepared','preposition',
  'prerequisite','prescribe','prescription','presence','present','presentation',
  'presently','preservation','preserve','preside','presidency','president',
  'presidential','press','pressure','prestige','prestigious','presumably',
  'presume','presumption','pretence','pretend','pretentious','pretext','pretty',
  'prevail','prevalence','prevalent','prevent','prevention','preventive',
  'preview','previous','prey','price','pride','priest','primarily','primary',
  'prime','primitive','prince','princess','principal','principle','print',
  'prior','priority','prison','prisoner','privacy','private','privatization',
  'privatize','privilege','privileged','prize','probability','probable',
  'probably','probe','problem','problematic','procedure','proceed','proceeding',
  'proceeds','process','procession','processor','proclaim','proclamation',
  'produce','producer','product','production','productive','productivity',
  'profess','profession','professional','professor','proficiency','proficient',
  'profile','profit','profitable','profound','program','programme','progress',
  'progression','progressive','prohibit','prohibition','project','projection',
  'proliferate','proliferation','prolific','prologue','prolong','prominent',
  'promise','promising','promote','promoter','promotion','prompt','prone',
  'pronounce','pronunciation','proof','propaganda','propagate','propel',
  'propeller','proper','properly','property','prophet','proponent','proportion',
  'proportional','proposal','propose','proposition','proprietor','prosecute',
  'prosecution','prosecutor','prospect','prospective','prosper','prosperity',
  'prosperous','protect','protection','protective','protector','protein',
  'protest','protester','protocol','prototype','proud','prove','provide',
  'province','provincial','provision','provisional','provocation','provocative',
  'provoke','proximity','prudent','psychiatric','psychiatrist','psychic',
  'psychological','psychologist','psychology','pub','public','publication',
  'publicity','publicize','publish','publisher','pudding','puddle','pull',
  'pulse','pump','punch','punctual','punctuality','punctuation','punish',
  'punishment','pupil','puppet','purchase','pure','purge','purity','purple',
  'purpose','purse','pursue','pursuit','push','puzzle','pyramid',
  // Q
  'qualification','qualified','qualify','qualitative','quality','quantify',
  'quantitative','quantity','quarantine','quarrel','quarry','quarter','quarterly',
  'quartz','queen','quest','question','questionable','questionnaire','queue',
  'quick','quiet','quilt','quit','quite','quota','quotation','quote',
  // R
  'rabbi','rabbit','race','racial','racing','racism','racist','rack','radar',
  'radiation','radical','radio','radioactive','radius','rage','raid','rail',
  'railroad','railway','rainbow','raise','rally','ram','ramp','rampant',
  'ranch','random','range','rank','ransom','rape','rapid','rapport','rat',
  'rate','rather','ratification','ratify','rating','ratio','ration','rational',
  'rationale','rationalize','rattle','raw','ray','razor','reach','react',
  'reaction','reactive','read','readable','reader','readily','reading','ready',
  'real','realism','realist','realistic','reality','realization','realize',
  'realm','reap','rear','reason','reasonable','reasonably','reasoning','reassure',
  'rebel','rebellion','rebuke','recall','receipt','receive','receiver','recent',
  'reception','receptionist','recession','recipe','recipient','reciprocal',
  'recital','recite','reckless','reckon','reclaim','recognition','recognize',
  'recommend','recommendation','reconcile','reconciliation','reconnaissance',
  'reconstruct','reconstruction','record','recorder','recording','recount',
  'recover','recovery','recreation','recreational','recruit','recruiter',
  'recruitment','rectangle','rectify','recur','recurrence','recurrent','recycle',
  'recycling','red','redesign','redevelop','reduce','reduction','redundancy',
  'redundant','refer','referee','reference','referendum','referral','refine',
  'refined','refinement','reflect','reflection','reflective','reform','refrain',
  'refresh','refreshment','refrigerator','refuge','refugee','refund','refusal',
  'refuse','refute','regain','regard','regarding','regardless','regime','region',
  'regional','register','registration','regress','regression','regret','regular',
  'regularity','regulate','regulation','regulator','regulatory','rehabilitate',
  'rehabilitation','reign','rein','reinforce','reinforcement','reject','rejection',
  'relate','relation','relational','relationship','relative','relativity',
  'relax','relaxation','relay','release','relevance','relevant','reliability',
  'reliable','reliance','relief','relieve','religion','religious','reluctant',
  'rely','remain','remainder','remains','remark','remarkable','remedial',
  'remedy','remember','remind','reminder','reminiscent','remission','remit',
  'remnant','remote','removal','remove','renaissance','render','renew',
  'renewable','renewal','rent','rental','repair','reparation','repay','repayment',
  'repeal','repeat','repeated','repeatedly','repel','repercussion','repettoire',
  'repetition','repetitive','replace','replacement','reply','report','reportedly',
  'reporter','repository','represent','representation','representative','repress',
  'repression','repressive','reprimand','reproach','reproduce','reproduction',
  'reproductive','reptile','republic','republican','repugnant','repulse',
  'reputation','request','require','requirement','requisite','rescue','research',
  'researcher','resemblance','resemble','resent','resentment','reservation',
  'reserve','reservoir','reside','residence','resident','residential','residual',
  'residue','resign','resignation','resilience','resilient','resist','resistance',
  'resistant','resolution','resolve','resonance','resort','resource','resourceful',
  'respect','respectable','respectful','respective','respectively','respirator',
  'respiratory','respond','respondent','response','responsibility','responsible',
  'responsive','rest','restaurant','restless','restoration','restore','restrain',
  'restraint','restrict','restriction','restrictive','result','resultant',
  'resume','resumption','resurgence','retail','retailer','retain','retainer',
  'retaliate','retaliation','retard','retention','reticent','retire','retired',
  'retirement','retort','retreat','retrieval','retrieve','retrospect',
  'retrospective','return','reunion','reveal','revelation','revenge','revenue',
  'revere','reverend','reverse','reversible','review','reviewer','revise',
  'revision','revival','revive','revoke','revolt','revolution','revolutionary',
  'revolve','reward','rewarding','rhetoric','rhetorical','rhythm','rib','ribbon',
  'rich','rid','riddle','ride','rider','ridge','ridicule','ridiculous','rifle',
  'rift','right','rightly','rigid','rigorous','rim','ring','riot','rip','ripe',
  'ripen','ripple','rise','risk','risky','ritual','rival','rivalry','river',
  'road','roar','rob','robbery','robe','robot','robust','rock','rocket','rod',
  'role','roll','romance','romantic','roof','room','root','rope','rose','rot',
  'rotary','rotate','rotation','rotten','rough','roughly','round','route',
  'routine','routinely','row','royal','royalty','rub','rubber','rubbish','rude',
  'rug','ruin','rule','ruler','ruling','rumor','run','runner','running','rural',
  'rush','rust','ruthless',
  // S
  'sabotage','sack','sacred','sacrifice','sad','saddle','safe','safeguard',
  'safety','sail','sailor','saint','sake','salad','salary','sale','salesman',
  'salmon','salon','salt','salute','salvage','salvation','sample','sanction',
  'sanctuary','sand','sane','sanitation','sarcasm','satellite','satire',
  'satisfaction','satisfactory','satisfied','satisfy','saturate','saturation',
  'sauce','save','saving','savings','scale','scan','scandal','scar','scarce',
  'scarcely','scarcity','scare','scarf','scatter','scenario','scene','scenery',
  'scent','schedule','schema','scheme','scholar','scholarship','school',
  'science','scientific','scientist','scope','score','scorn','scrap','scrape',
  'scratch','screen','screening','screw','script','scrutiny','sculpture','sea',
  'seal','seam','search','seaside','season','seasonal','seat','second','secondary',
  'secrecy','secret','secretariat','secretary','secrete','section','sector',
  'secure','security','sediment','seed','seek','segment','segregate','segregation',
  'seismic','seize','seizure','select','selection','selective','self','semester',
  'semiconductor','seminar','senate','senator','send','senior','seniority',
  'sensation','sensational','sense','sensible','sensitive','sensitivity','sensor',
  'sentence','sentiment','sentimental','separate','separation','sequence',
  'serene','serial','series','serious','sermon','serum','servant','serve',
  'service','session','setback','setting','settle','settlement','settler','severe',
  'severity','sew','sewage','sex','sexual','shade','shadow','shaft','shake',
  'shall','shallow','shame','shape','share','shareholder','shark','sharp',
  'sharpen','shatter','shave','shed','sheer','sheet','shelf','shell','shelter',
  'shepherd','shield','shift','shilling','shine','ship','shipment','shirt',
  'shock','shoe','shoot','shooting','shop','shopping','shore','short','shortage',
  'shortcoming','shortly','shot','shoulder','shout','shovel','show','showcase',
  'shower','shred','shrewd','shrink','shrub','shrug','shutdown','shutter',
  'shuttle','sibling','sick','side','sideways','siege','sigh','sight','sightseeing',
  'sign','signal','signature','significance','significant','signify','silence',
  'silent','silicon','silk','silly','silver','similar','similarity','simple',
  'simplicity','simplify','simplistic','simulate','simulation','simultaneous',
  'sin','sincere','sincerity','sing','singer','single','singular','sink','sip',
  'site','situation','size','skeptical','sketch','skill','skilled','skillful',
  'skim','skin','skip','skirt','skull','sky','skyscraper','slack','slam',
  'slang','slap','slash','slate','slaughter','slave','slavery','sleep','sleeve',
  'slender','slice','slide','slight','slightly','slim','slip','slogan','slope',
  'slot','slow','slowly','slump','small','smart','smash','smell','smile','smog',
  'smoke','smooth','smuggle','snack','snap','snow','soak','soar','sober','soccer',
  'social','socialism','socialist','socialize','society','socioeconomic',
  'sociological','sociologist','sociology','sock','socket','soda','soft',
  'software','soil','solar','soldier','sole','solely','solemn','solid',
  'solidarity','solo','solution','solve','solvent','somewhat','son','song',
  'soon','sophisticated','sore','sorrow','sorry','sort','soul','sound','soup',
  'sour','source','south','southeast','southern','southwest','sovereign',
  'sovereignty','space','spacecraft','spacious','span','spare','spark','sparkle',
  'spatial','speak','speaker','special','specialist','specialize','specialty',
  'species','specific','specification','specify','specimen','spectacle',
  'spectacular','spectator','spectrum','speculate','speculation','speculative',
  'speech','speed','spell','spelling','spend','sphere','spice','spider','spill',
  'spin','spine','spiral','spirit','spiritual','spite','splash','splendid',
  'split','spoil','spokesman','spokesperson','sponsor','sponsorship','spontaneous',
  'spot','spotlight','spouse','spray','spread','spring','sprinkle','spur',
  'spy','squad','square','squeeze','stability','stabilize','stable','stadium',
  'staff','stage','stagger','stagnant','stagnate','stain','stainless','stair',
  'staircase','stake','stale','stalk','stall','stamp','stance','stand','standard',
  'standpoint','staple','star','stare','start','startle','starvation','starve',
  'state','statement','statesman','static','station','stationary','statistic',
  'statistical','statistics','statue','status','statute','statutory','stay',
  'steady','steal','steam','steel','steep','steer','stem','step','stereotype',
  'sterile','sterling','stern','steward','stick','sticky','stiff','stifle',
  'stigma','still','stimulate','stimulation','stimulus','sting','stir','stitch',
  'stock','stocking','stomach','stone','stool','stop','storage','store','storm',
  'stormy','story','stove','straight','straightforward','strain','strand',
  'strange','stranger','strap','strategic','strategy','straw','stray','streak',
  'stream','streamline','street','strength','strengthen','stress','stretch',
  'strict','stride','strife','strike','striking','string','strip','stripe',
  'strive','stroke','stroll','strong','structure','struggle','student','studio',
  'study','stuff','stumble','stun','stunt','stupid','sturdy','style','sub',
  'subject','subjective','sublime','submarine','submerge','submission','submissive',
  'submit','subordinate','subscribe','subscriber','subscription','subsequent',
  'subside','subsidiary','subsidize','subsidy','substance','substantial',
  'substantially','substantiate','substitute','substitution','subtle','subtract',
  'subtraction','suburb','suburban','subway','succeed','success','successful',
  'succession','successive','successor','suck','sudden','sue','suffer','suffering',
  'suffice','sufficiency','sufficient','suffix','sugar','suggest','suggestion',
  'suicide','suit','suitable','suite','sulfur','sum','summarize','summary',
  'summit','summon','sun','superb','superficial','superfluous','superintendent',
  'superior','superiority','supermarket','supernatural','supervise','supervision',
  'supervisor','supplement','supplementary','supply','support','supporter',
  'supportive','suppose','supposedly','suppress','suppression','supreme','sure',
  'surface','surge','surgeon','surgery','surgical','surplus','surprise',
  'surprising','surrender','surround','surroundings','surveillance','survey',
  'survival','survive','survivor','susceptibility','susceptible','suspect',
  'suspend','suspension','suspicion','suspicious','sustain','sustainability',
  'sustainable','swallow','swamp','swap','swarm','sway','swear','sweat',
  'sweater','sweep','sweet','swell','swift','swim','swing','swirl','switch',
  'sword','symbol','symbolic','symbolism','symmetry','sympathetic','sympathize',
  'sympathy','symphony','symptom','syndicate','syndrome','synonym','synthesis',
  'synthesize','synthetic','system','systematic',
  // T
  'table','tablet','tack','tackle','tactic','tactical','tag','tail','tailor',
  'take','tale','talent','talented','talk','tall','tame','tan','tangible',
  'tangle','tank','tanker','tap','tape','target','tariff','task','taste','tax',
  'taxation','taxi','taxpayer','teach','teacher','teaching','team','tear',
  'tease','technical','technicality','technician','technique','technological',
  'technology','tedious','teen','teenage','teenager','telecommunications',
  'telephone','telescope','television','tell','temper','temperature','temple',
  'tempo','temporary','tempt','temptation','tenant','tend','tendency','tender',
  'tennis','tense','tension','tent','tentative','tenure','term','terminal',
  'terminate','termination','terminology','terrace','terrain','terrible',
  'terrific','terrify','territorial','territory','terror','terrorism','terrorist',
  'tertiary','test','testament','testify','testimony','testing','text','textbook',
  'textile','texture','thanksgiving','theater','theatre','theft','theme',
  'theological','theology','theoretical','theorist','theory','therapeutic',
  'therapist','therapy','thereafter','thereby','therefore','thermal','thesis',
  'thick','thief','thin','thing','think','thinking','thirst','thirsty','thorough',
  'thought','thoughtful','thousand','thrash','thread','threat','threaten',
  'threshold','thrill','thrilling','thrive','throat','throne','throughout',
  'throw','thrust','thumb','thunder','thus','tick','ticket','tide','tidy',
  'tie','tiger','tight','tighten','tile','till','tilt','timber','time','timely',
  'timetable','timid','timing','tin','tiny','tip','tire','tired','tissue',
  'title','toast','tobacco','today','toe','together','toilet','token','tolerance',
  'tolerant','tolerate','toll','tomato','tomb','tomorrow','ton','tone','tongue',
  'tonight','tonnage','tool','tooth','top','topic','topple','torch','torment',
  'tornado','torrent','torture','toss','total','touch','tough','tour','tourism',
  'tourist','tournament','toward','towel','tower','town','toxic','toxin','trace',
  'track','tract','traction','trade','trademark','trader','tradition','traditional',
  'traffic','tragedy','tragic','trail','trailer','train','trait','trajectory',
  'transaction','transcend','transcript','transfer','transform','transformation',
  'transformer','transient','transit','transition','translate','translation',
  'translator','transmission','transmit','transparency','transparent','transplant',
  'transport','transportation','trap','trash','trauma','traumatic','travel',
  'traveler','traverse','tray','treasure','treasury','treat','treatment','treaty',
  'trek','tremble','tremendous','trend','trial','triangle','tribe','tribunal',
  'tribute','trick','trigger','trim','trip','triumph','trivial','troop','trophy',
  'tropical','trouble','troublesome','trousers','truck','true','truly','trumpet',
  'trunk','trust','trustee','trustworthy','truth','try','tub','tube','tuition',
  'tumble','tune','tunnel','turbine','turbulence','turbulent','turmoil','turn',
  'turnover','tutor','tutorial','twin','twist','two','type','typical','typically',
  'tyranny','tyrant',
  // U
  'ugly','ultimate','ultimatum','ultra','umbrella','unable','unacceptable',
  'unanimous','unanswered','unaware','uncertain','uncertainty','unchanged',
  'uncle','uncomfortable','uncommon','unconscious','unconstitutional',
  'unconventional','uncover','undercover','underestimate','undergo',
  'undergraduate','underground','underline','underlying','undermine','underneath',
  'understand','understanding','undertake','undertaking','underway','underwear',
  'undesirable','undisputed','undo','undoubtedly','undue','unearth','uneasy',
  'unemployed','unemployment','unequal','unexpected','unfair','unfold',
  'unforeseen','unfortunate','unfortunately','unfriendly','unhappy','unhealthy',
  'unification','uniform','unify','unilateral','unimportant','unintended',
  'union','unique','unit','unite','united','unity','universal','universe',
  'university','unjust','unknown','unlawful','unleash','unless','unlike',
  'unlikely','unlimited','unload','unlock','unnecessary','unpaid','unpleasant',
  'unpopular','unprecedented','unpredictable','unproductive','unprofessional',
  'unqualified','unquestionable','unravel','unrealistic','unreasonable',
  'unrelated','unreliable','unresolved','unrest','unruly','unsatisfactory',
  'unscientific','unskilled','unstable','unsuccessful','unsuitable','untidy',
  'untie','until','untouched','unusual','unveil','unwanted','unwilling','unwind',
  'unwise','unworthy','upcoming','update','upgrade','upheaval','uphold','upkeep',
  'upon','upper','upright','uprising','uproar','upset','upside','up-to-date',
  'upward','urban','urge','urgency','urgent','usage','use','used','useful',
  'useless','user','usual','utility','utilize','utmost','utter',
  // V
  'vacancy','vacant','vacation','vaccinate','vaccination','vaccine','vacuum',
  'vague','valid','validate','validity','valley','valuable','valuation','value',
  'valve','van','vanish','vanity','vapor','variable','variation','varied',
  'variety','various','vary','vast','vault','vegetable','vegetation','vehicle',
  'veil','vein','velocity','vendor','venture','venue','verb','verbal','verdict',
  'verge','versatile','verse','version','versus','vertical','vessel','veteran',
  'veterinarian','veto','viability','viable','vibrant','vibrate','vibration',
  'vice','vicinity','vicious','victim','victorious','victory','video','view',
  'viewer','viewpoint','vigorous','village','villain','vine','vineyard','violate',
  'violation','violence','violent','violet','violin','virgin','virtual','virtue',
  'virus','visa','visibility','visible','vision','visit','visitor','visual',
  'vital','vitamin','vivid','vocabulary','vocal','vocation','vocational','voice',
  'void','volatile','volcano','volleyball','volume','voluntary','volunteer',
  'vote','voter','voucher','vow','vowel','voyage','vulgar','vulnerable',
  // W
  'wade','wage','wagon','waist','wait','waiter','waive','wake','walk','wall',
  'wallet','wander','want','ward','wardrobe','warehouse','warfare','warm',
  'warmth','warn','warning','warrant','warranty','warrior','wary','wash','waste',
  'wasteful','watch','water','waterfall','waterproof','watershed','wave','waver',
  'wax','way','weak','weaken','weakness','wealth','wealthy','weapon','wear',
  'weather','weave','web','website','wedding','weed','weekend','weekly','weigh',
  'weight','weird','welcome','weld','welfare','well-being','west','western',
  'wet','whale','wheat','wheel','whereas','whereby','whether','which','while',
  'whip','whisper','whistle','white','whole','wholesale','wholesome','wholly',
  'widespread','widow','width','wield','wife','wild','wildlife','will','willing',
  'win','wind','window','wine','wing','winner','winter','wipe','wire','wisdom',
  'wise','wish','wit','witch','withdraw','withdrawal','withhold','within',
  'without','witness','wolf','woman','wonder','wonderful','wood','wooden','wool',
  'word','wording','work','worker','workforce','working','workout','workshop',
  'world','worldwide','worm','worry','worse','worship','worst','worth','worthless',
  'worthwhile','worthy','wound','wrap','wrath','wreck','wrist','write','writer',
  'writing','written','wrong',
  // Y
  'yard','yawn','year','yearly','yeast','yell','yellow','yield','yoga','yogurt',
  'young','youngster','youth','youthful',
  // Z
  'zeal','zebra','zero','zigzag','zinc','zip','zone','zoo'
]

// ========== 5. MERGING LOGIC ==========
/** Merge a built-in entry with ECDICT + DeepSeek-generated content.
 *  Priority: builtIn > ECDICT > DeepSeek */
/** Build paired example strings from deepseek examples + optional built-in pair.
 *  Only complete (en+zh) pairs are kept, no orphan sentences. */
function buildExamples(
  deepseek: DeepSeekWord | null,
  builtInPair?: { en: string; zh?: string },
): { example?: string; exampleZh?: string } {
  const pairs: { en: string; zh: string }[] = []

  // Built-in pair first if it has both en and zh
  if (builtInPair?.en && builtInPair.zh) {
    pairs.push({ en: builtInPair.en, zh: builtInPair.zh })
  }

  // DeepSeek pairs next
  if (deepseek?.examples) {
    for (const ex of deepseek.examples) {
      if (ex.en && ex.zh) {
        pairs.push({ en: ex.en, zh: ex.zh })
      }
    }
  }

  if (pairs.length === 0) {
    // Fallback: built-in with en only
    if (builtInPair?.en) {
      return { example: builtInPair.en }
    }
    // Fallback: deepseek en only
    if (deepseek?.examples?.[0]?.en) {
      return { example: deepseek.examples[0].en }
    }
    return {}
  }

  return {
    example: pairs.map(p => p.en).join(' ||| '),
    exampleZh: pairs.map(p => p.zh).join(' ||| '),
  }
}

function mergeEntry(
  builtIn: VocabEntry | null,
  ecdict: EcdictEntry | null,
  deepseek: DeepSeekWord | null,
): VocabEntry {
  // Layer 1: built-in word — authoritative, ECDICT only fills gaps
  if (builtIn) {
    const examples = buildExamples(
      deepseek,
      builtIn.example ? { en: builtIn.example, zh: builtIn.exampleZh || undefined } : undefined,
    )

    return {
      word: builtIn.word,
      phonetic: builtIn.phonetic || ecdict?.phonetic || undefined,
      partOfSpeech: builtIn.partOfSpeech,
      definition: builtIn.definition,
      collocations: builtIn.collocations || deepseek?.collocations || undefined,
      ...examples,
    }
  }

  // Layer 2: ECDICT word — authoritative phonetic + definition, DeepSeek supplements
  if (ecdict) {
    const pos = ecdict.translation?.match(/^(v\.|n\.|adj\.|adv\.|prep\.|conj\.|pron\.|int\.|art\.|num\.|vi\.|vt\.|aux\.|modal\.)/)?.[1] || ''
    const examples = buildExamples(deepseek)
    return {
      word: ecdict.word,
      phonetic: ecdict.phonetic || undefined,
      partOfSpeech: pos,
      definition: ecdict.translation || ecdict.definition || '',
      collocations: deepseek?.collocations || undefined,
      ...examples,
    }
  }

  // Layer 3: DeepSeek-only fallback
  if (deepseek) {
    const examples = buildExamples(deepseek)
    return {
      word: deepseek.word,
      phonetic: deepseek.phonetic,
      partOfSpeech: deepseek.partOfSpeech || '',
      definition: deepseek.definition || '',
      collocations: deepseek.collocations || undefined,
      ...examples,
    }
  }

  // Fallback (should rarely happen)
  return { word: 'unknown', partOfSpeech: '', definition: '' }
}

// ========== 6. ECDICT DATABASE ==========
/** Download ECDICT zip from GitHub and extract the SQLite database */
function ensureEcdictDb(): void {
  if (fs.existsSync(ECDICT_DB_PATH)) {
    console.log('ECDICT database already exists')
    return
  }

  console.log('Downloading ECDICT dictionary (≈85 MB)...')
  fs.mkdirSync(ECDICT_DIR, { recursive: true })

  try {
    console.log('Downloading with curl...')
    execSync(
      `curl -L -o "${ECDICT_ZIP_PATH}" "${ECDICT_ZIP_URL}"`,
      { stdio: 'inherit', timeout: 300_000 },
    )
    const stat = fs.statSync(ECDICT_ZIP_PATH)
    console.log(`Downloaded ${(stat.size / 1024 / 1024).toFixed(1)} MB, extracting...`)

    const zip = new AdmZip(ECDICT_ZIP_PATH)
    zip.extractAllTo(ECDICT_DIR, true)
    fs.unlinkSync(ECDICT_ZIP_PATH)

    if (!fs.existsSync(ECDICT_DB_PATH)) {
      throw new Error('stardict.db not found in extracted archive')
    }
    console.log('ECDICT database ready')
  } catch (err) {
    console.warn('⚠ Failed to download ECDICT:', err instanceof Error ? err.message : err)
    console.warn('  Will seed without ECDICT data')
  }
}

/** Load ECDICT entries into a Map for fast lookup */
function loadEcdictData(): Map<string, EcdictEntry> {
  if (!fs.existsSync(ECDICT_DB_PATH)) {
    console.warn('ECDICT database not found — skipping')
    return new Map()
  }
  const db = new DatabaseSync(ECDICT_DB_PATH)
  const rows = db.prepare('SELECT word, phonetic, definition, translation, tag FROM stardict').all()
  const map = new Map<string, EcdictEntry>()
  for (const row of rows) {
    const r = row as unknown as EcdictEntry
    const key = r.word.toLowerCase()
    if (!map.has(key)) {
      map.set(key, r)
    }
  }
  db.close()
  console.log(`Loaded ${map.size} entries from ECDICT`)
  return map
}

// ========== 7. MAIN ==========
async function main() {
  // ---- Build word list ----
  const builtInMap = new Map<string, VocabEntry>()
  for (const entry of getBuiltInWords()) {
    builtInMap.set(entry.word.toLowerCase(), entry)
  }
  console.log(`Built-in words: ${builtInMap.size}`)

  // ---- Load ECDICT ----
  ensureEcdictDb()
  const ecdictData = loadEcdictData()

  // Add extra IELTS words (filtered by ECDICT tag)
  const allWords = new Map<string, boolean>()
  for (const w of builtInMap.keys()) allWords.set(w, true)
  let extraAdded = 0
  let extraSkipped = 0
  for (const w of EXTRA_WORDS) {
    const key = w.toLowerCase()
    if (allWords.has(key)) continue
    // Only add if ECDICT confirms this is an IELTS word
    const ecdict = ecdictData.get(key)
    if (ecdict?.tag?.includes('ielts')) {
      allWords.set(key, true)
      extraAdded++
    } else {
      extraSkipped++
    }
  }

  const wordList = Array.from(allWords.keys()).slice(0, MAX_WORDS)
  console.log(`Total words to seed: ${wordList.length} (${extraAdded} ECDICT-verified IELTS extras, ${extraSkipped} non-IELTS skipped)`)

  // ---- Determine which words need DeepSeek generation ----
  const needDeepSeek: string[] = []
  for (const word of wordList) {
    const builtIn = builtInMap.get(word)
    if (!builtIn) {
      // ECDICT word — only need DeepSeek for collocations + examples
      needDeepSeek.push(word)
      continue
    }
    // Built-in word — only if missing collocations or examples
    if (!builtIn.collocations || !builtIn.example?.includes(' ||| ')) {
      needDeepSeek.push(word)
    }
  }

  // ---- Try loading cached generated data ----
  let deepseekData: Record<string, DeepSeekWord> = {}
  if (fs.existsSync(GENERATED_PATH)) {
    try {
      deepseekData = JSON.parse(fs.readFileSync(GENERATED_PATH, 'utf-8'))
      console.log(`Loaded cached AI-generated data for ${Object.keys(deepseekData).length} words`)
    } catch {
      console.warn('Cache file corrupt, will regenerate')
    }
  }

  // ---- Generate missing data ----
  const missingFromCache = needDeepSeek.filter(w => !deepseekData[w])
  if (missingFromCache.length > 0) {
    console.log(`Generating data for ${missingFromCache.length} words via DeepSeek...`)
    const generated = await generateWithDeepSeek(missingFromCache)
    Object.assign(deepseekData, generated)
    try {
      fs.writeFileSync(GENERATED_PATH, JSON.stringify(deepseekData, null, 2))
      console.log('Saved generated data to cache')
    } catch {
      // non-fatal
    }
  }

  // ---- Build final vocab entries ----
  const finalEntries: VocabEntry[] = []
  for (const word of wordList) {
    const builtIn = builtInMap.get(word) || null
    const ecdict = ecdictData.get(word) || null
    const deepseek = deepseekData[word] || null
    finalEntries.push(mergeEntry(builtIn, ecdict, deepseek))
  }

  console.log(`Built ${finalEntries.length} vocabulary entries`)

  // ---- Write to database ----
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! })
  const prisma = new PrismaClient({ adapter })

  const existing = await prisma.word.count()
  if (existing > 0) {
    console.log(`Database already has ${existing} words. Re-seeding...`)
    await prisma.wordReview.deleteMany()
    await prisma.word.deleteMany()
  }

  const BATCH = 100
  for (let i = 0; i < finalEntries.length; i += BATCH) {
    const batch = finalEntries.slice(i, i + BATCH)
    await prisma.word.createMany({
      data: batch.map((e) => ({
        word: e.word,
        phonetic: e.phonetic ?? null,
        partOfSpeech: e.partOfSpeech,
        definition: e.definition,
        collocations: e.collocations ?? null,
        example: e.example ?? null,
        exampleZh: e.exampleZh ?? null,
        difficulty: 'IELTS',
        source: 'ielts',
      })),
    })
    if ((i + BATCH) % 500 === 0 || i + BATCH >= finalEntries.length) {
      console.log(`  Inserted ${Math.min(i + BATCH, finalEntries.length)}/${finalEntries.length} words`)
    }
  }

  // ---- Process theme word packs ----
  const THEMES = ['kitchen', 'car', 'clothing', 'restaurant', 'hotel', 'body', 'office', 'technology', 'school', 'sports', 'shopping', 'transportation', 'entertainment', 'weather', 'home', 'people', 'mechanical-engineering', 'computer-ai', 'automotive', 'foreign-trade']
  const SCENE_CACHE_PATH = path.resolve(process.cwd(), 'prisma', 'generated_scene_data.json')

  let sceneCache: Record<string, { deepseek: DeepSeekWord | null; imageUrl: string | null }> = {}
  if (fs.existsSync(SCENE_CACHE_PATH)) {
    try {
      sceneCache = JSON.parse(fs.readFileSync(SCENE_CACHE_PATH, 'utf-8'))
      console.log(`Loaded scene word cache: ${Object.keys(sceneCache).length} entries`)
    } catch { /* ignore */ }
  }

  for (const theme of THEMES) {
    const themeWords = getThemeWords(theme)
    if (themeWords.length === 0) continue
    console.log(`Processing "${theme}" theme (${themeWords.length} words)...`)

    // Generate DeepSeek for uncached
    const uncached = themeWords.filter(w => !sceneCache[w.word.toLowerCase()])
    if (uncached.length > 0) {
      console.log(`  Generating data for ${uncached.length} "${theme}" words via DeepSeek...`)
      const generated = await generateWithDeepSeek(uncached.map(w => w.word), genScenePrompt)
      for (const w of uncached) {
        sceneCache[w.word.toLowerCase()] = { deepseek: generated[w.word.toLowerCase()] || null, imageUrl: null }
      }
    }

    // Fetch Wikipedia images
    let imgFetched = 0
    for (const w of themeWords) {
      const cached = sceneCache[w.word.toLowerCase()]
      if (cached && cached.imageUrl === null) {
        cached.imageUrl = await fetchWikipediaImage(w.word)
        await new Promise(r => setTimeout(r, 150))
        imgFetched++
      }
    }
    if (imgFetched > 0) {
      try { fs.writeFileSync(SCENE_CACHE_PATH, JSON.stringify(sceneCache, null, 2)) } catch {}
      console.log(`  Fetched ${imgFetched} images`)
    }

    // Insert theme words
    let inserted = 0
    for (let i = 0; i < themeWords.length; i += BATCH) {
      const batch = themeWords.slice(i, i + BATCH)
      await prisma.word.createMany({
        data: batch.map((w) => {
          const key = w.word.toLowerCase()
          const ds = sceneCache[key]?.deepseek
          const imgUrl = sceneCache[key]?.imageUrl || null
          const ecdict = ecdictData.get(key)
          return {
            word: w.word,
            phonetic: ecdict?.phonetic || ds?.phonetic || null,
            partOfSpeech: w.partOfSpeech || ds?.partOfSpeech || '',
            definition: w.definition || ecdict?.translation || ecdict?.definition || ds?.definition || '',
            collocations: ds?.collocations || null,
            example: ds?.examples?.[0]?.en || null,
            exampleZh: ds?.examples?.[0]?.zh || null,
            imageUrl: imgUrl,
            theme,
            difficulty: 'THEME',
            source: 'theme',
          }
        }),
      })
      inserted += batch.length
    }
    console.log(`  Inserted ${inserted} "${theme}" words`)
  }

  try { fs.writeFileSync(SCENE_CACHE_PATH, JSON.stringify(sceneCache, null, 2)) } catch {}

  const count = await prisma.word.count()
  console.log(`✓ Seed complete: ${count} words imported.`)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Seed failed:', e)
  process.exit(1)
})
