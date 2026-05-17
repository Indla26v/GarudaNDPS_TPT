import prisma from './src/config/prisma';

const psNames = [
  "CCS Tirupati", "East PS", "Alipiri PS", "West PS", "S.V.U.Campus PS", 
  "Tiruchanur PS", "Tirupati Rural P.S.", "Chandragiri P.S.", "RC Puram PS", 
  "Pakala PS", "Bhakarapet PS", "Y.V. Palem PS", "Renigunta", "Yerpedu", 
  "Gajuluamandyam", "Rly Kodur UPS", "Chitvel", "Obulavaripalli", "Pullampeta", 
  "Penagalur", "SKHT I-Town", "SKHT II-Town", "SKHT(R)", "Thottambedu", 
  "B.N.Kandriga", "Puttur Urban", "Vadamalapeta", "Narayanavaram", "Pichatur", 
  "KVB Puram", "Sathyavedu", "Varadhaiapalam", "Nagalapuram", "Venkatagiri", 
  "Balayapalli", "Dakkili", "Vakadu", "Chittamur", "Naidupet PS", "Sullurpet", 
  "Tada", "Sriharikota", "Pellakur PS", "D.V.Satram", "Ozili"
];

async function seedPS() {
  let counter = 1;
  for (const name of psNames) {
    const code = `TPT-${counter.toString().padStart(3, '0')}`;
    
    // check if exists
    const existing = await prisma.police_stations.findFirst({ where: { name } });
    if (!existing) {
      await prisma.police_stations.create({
        data: {
          name: name,
          district: "Tirupati",
          state: "Andhra Pradesh",
          ps_code: code
        }
      });
      console.log(`Created PS: ${name} (${code})`);
    } else {
      console.log(`PS ${name} already exists.`);
    }
    counter++;
  }
}

seedPS().catch(console.error).finally(() => prisma.$disconnect());
