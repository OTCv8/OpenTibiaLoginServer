// Benchmark for Tibia TCP protocol

import Config from '../src/config';
import Crypto from '../src/crypto';
import DB from '../src/db';
import TibiaTCP from '../src/tcp';


// invalid packet (wrong rsa)
const packet1hex = "889563210102004b044b040000474300006b10ff57e7ddc556002cad2e565424e2b2bb723d3577c0e6a34d5ccee1cc596fce66f6c930450de59c290680c567f2c15143ca4aab00659bf1da2174736796b5fcf965dbecf95d96ddfa93595390ab2bac846c5cd28944ac3f00d6b375984073e37a9cb70c3eae4a7b8abcca050436bd4b1b6347817272b5762433b13ec6c261d031b31f3fccf3fa0701011f00496e74656c20496e74656c28522920554844204772617068696373203632301c00342e352e30202d204275696c642032342e32302e3130302e363238376d4b1d1f805f7bd35ac938199c08276134a74613c5a8d64b4ccdcfb891e122b6747c629a42dbdb5884346d7ec688869e425bd301da1177c42c34f379536eed72aac0de49807434ef8f81b801b75ff52fc15c0518b92673fc0c8b7fab0ecd443f3b1b68879349ba3d13b228e64379a549de43f7a8ee6aaf12ed1b984dc9ecf864";
const packet1 = Buffer.from(packet1hex, 'hex');

// 123456/123456, version 1099
const packet2hex = "e897e00d0102004b044b040000474300006b10ff57e7ddc5560045dd34e068ba6cea0f3335ca786cf0a178072ce645f128e8b668c99bb94034c0b13f9f6c9b6ca72c0a21ff8cb6c81ccf613fbabdaadd4077085ac85ffe30d1e9dd48342b56a2d4ad387b477c58866a3ab697b227f87941b5f658716aa6c5271726fc09401e337ba4f5ec9c268136ea56125a92773ea58d73f0bab4a43bcda2fb01011f00496e74656c20496e74656c28522920554844204772617068696373203632301c00342e352e30202d204275696c642032342e32302e3130302e3632383795d307b336b354a67ced9a09a053ee352f6fa38d19ecef55df992e89b697945d543d4bf999d148380d6ac12808614248e6e80c36054e084f48c442f90e1fb49ecadd6e596a905fe8b94f6cd6d98d361e917050a3f529788cdf9371c5daa95fa54aaae20868d163baee0ca32ba1aa8bf3e73199515b5efe3b8629fa9324e7a1dc";
const packet2 = Buffer.from(packet2hex, 'hex');

// acc1/acc, version 1099
const packet3hex = "709bbe160102004b044b040000474300006b10ff57e7ddc556008468c864fd22c9c42864f9289cb97afd53205437f0fe5b337770c0c6686883ba79da40fb12c49547e5008312750b399e75cc6047d3522aed294cd0db31b1af26939f9e12a455c062dae6e7c860fa25eb62cfedab74658023cfc5285d50c1b6a584a212230f5973544fedcab5d11f629a7e804d6257c59bcab93fd41997c3249001011f00496e74656c20496e74656c28522920554844204772617068696373203632301c00342e352e30202d204275696c642032342e32302e3130302e3632383705f8f6eb8c92e3bdc8ad67c6029e20862b7b73912fe295e93ebf9d7af274916d1df7d255e6db53408aa9149a92d4e75944efa239a3152590505ac9e82ef4575bb8595dd8a930caeea4025d8f6678ea95a19123a995bc527e59418f99cdf5ea7a3ee70042d0ad4e40650b63bf74ca205c5ffc4f70b1c1a25f019fa66e1fd6027f";
const packet3 = Buffer.from(packet3hex, 'hex');

const packets = 1000;

Crypto.init();
let server = new TibiaTCP();

let benchmark = async (packet, name) => {
    console.log(`Benchmarking: ${name}`);
    let start = (new Date()).getTime();
    let calls = [];
    for (let i = 0; i < packets; ++i) {
        calls.push(server.benchmark(packet));
    }
    await Promise.all(calls);
    let end = (new Date()).getTime();
    console.log(`Processed ${packets} packets in ${(end - start)} ms.`);
}

console.log("Starting benchmark...");
DB.start().then(async () => {
    console.log("Connected to mysql database");
    await benchmark(packet1, "First packet (invalid packet)");
    await benchmark(packet2, "Second packet (invalid password)");
    await benchmark(packet3, "Third packet (correct login)");
    DB.stop();
}).catch((e) => {
    console.log("Error: can't connect to mysql host");
    console.log(e);
    process.exit(-1);
});

