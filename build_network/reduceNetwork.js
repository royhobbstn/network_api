
const fs = require('fs').promises;

main();

async function main() {
  try {
    console.log('reading.');
    const raw_geo = await fs.readFile('./faf.geojson');
    console.log('reading completed');

    console.log('mapping');
    const new_geo = JSON.parse(raw_geo).features
      .filter(f => {
        // filter out STATUS = 2 (ferry route)
        return f.properties.STATUS !== 2
      })
      .map(f => {
      const MPH = getMPH(f.properties.NHS);
      const coords = f.geometry.coordinates;
      return {
        ID: f.properties.ID,
        MILES: f.properties.MILES,
        MPH: MPH,
        STFIPS: f.properties.STFIPS,
        CTFIPS: f.properties.CTFIPS,
        MINUTES: (60/MPH) * f.properties.MILES,
        START: coords[0].join(','),
        END: coords[coords.length-1].join(',')
      }
    });
    console.log('mapping completed');

    console.log('writing');
    await fs.writeFile('./network.json', JSON.stringify(new_geo), 'utf8');
    console.log('writing completed');

  } catch(e) {
    console.log(e);
  }
}

function getMPH(nhs) {
  switch(nhs) {
    case 1:
      return 70;
    case 2:
      return 60;
    case 3:
      return 50;
    case 4:
      return 40;
    case 7:
      return 30;
    case 8:
      return 20;
    default:
      return 10;
  }

}