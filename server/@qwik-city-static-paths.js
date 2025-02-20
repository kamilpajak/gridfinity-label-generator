const staticPaths = new Set(["/nuts/din_1478.jpg", "/nuts/din_1479.jpg", "/nuts/din_1480.jpg", "/nuts/din_1587.jpg", "/nuts/din_1804.jpg", "/nuts/din_1816.jpg", "/nuts/din_2510.jpg", "/nuts/din_315.jpg", "/nuts/din_431.jpg", "/nuts/din_439.jpg", "/nuts/din_466.jpg", "/nuts/din_467.jpg", "/nuts/din_508.jpg", "/nuts/din_546.jpg", "/nuts/din_557.jpg", "/nuts/din_562.jpg", "/nuts/din_582.jpg", "/nuts/din_6330.jpg", "/nuts/din_6331.jpg", "/nuts/din_6334.jpg", "/nuts/din_6915.jpg", "/nuts/din_6923.jpg", "/nuts/din_6925.jpg", "/nuts/din_6926.jpg", "/nuts/din_6927.jpg", "/nuts/din_70852.jpg", "/nuts/din_74361.jpg", "/nuts/din_7965.jpg", "/nuts/din_7967.jpg", "/nuts/din_80701.jpg", "/nuts/din_80705.jpg", "/nuts/din_917.jpg", "/nuts/din_928.jpg", "/nuts/din_929.jpg", "/nuts/din_934.jpg", "/nuts/din_935.jpg", "/nuts/din_936.jpg", "/nuts/din_937.jpg", "/nuts/din_979.jpg", "/nuts/din_980.jpg", "/nuts/din_981.jpg", "/nuts/din_982.jpg", "/nuts/din_985.jpg", "/nuts/din_986.jpg", "/nuts/iso_7040.jpg", "/q-manifest.json", "/qwik-prefetch-service-worker.js", "/screws/din_11014.jpg", "/screws/din_15237.jpg", "/screws/din_186.jpg", "/screws/din_21346.jpg", "/screws/din_22424.jpg", "/screws/din_2510.jpg", "/screws/din_25193.jpg", "/screws/din_261.jpg", "/screws/din_316.jpg", "/screws/din_34817.jpg", "/screws/din_404.jpg", "/screws/din_444.jpg", "/screws/din_464.jpg", "/screws/din_478.jpg", "/screws/din_479.jpg", "/screws/din_480.jpg", "/screws/din_561.jpg", "/screws/din_564.jpg", "/screws/din_571.jpg", "/screws/din_580.jpg", "/screws/din_5903.jpg", "/screws/din_603.jpg", "/screws/din_604.jpg", "/screws/din_605.jpg", "/screws/din_607.jpg", "/screws/din_608.jpg", "/screws/din_609.jpg", "/screws/din_610.jpg", "/screws/din_653.jpg", "/screws/din_6912.jpg", "/screws/din_6914.jpg", "/screws/din_6921.jpg", "/screws/din_787.jpg", "/screws/din_792.jpg", "/screws/din_7968.jpg", "/screws/din_7969.jpg", "/screws/din_7984.jpg", "/screws/din_7990.jpg", "/screws/din_7991.jpg", "/screws/din_7995.jpg", "/screws/din_7996.jpg", "/screws/din_7997.jpg", "/screws/din_7999.jpg", "/screws/din_912.jpg", "/screws/din_931.jpg", "/screws/din_933.jpg", "/screws/din_95.jpg", "/screws/din_96.jpg", "/screws/din_960.jpg", "/screws/din_961.jpg", "/screws/din_97.jpg", "/screws/iso_7379.jpg", "/screws/iso_7380-1.jpg", "/screws/iso_7380-2.jpg", "/sitemap.xml", "/washers/din_1052.jpg", "/washers/din_125.jpg", "/washers/din_127.jpg", "/washers/din_128.jpg", "/washers/din_137.jpg", "/washers/din_1440.jpg", "/washers/din_1441.jpg", "/washers/din_2093.jpg", "/washers/din_25201.jpg", "/washers/din_432.jpg", "/washers/din_433.jpg", "/washers/din_434.jpg", "/washers/din_435.jpg", "/washers/din_436.jpg", "/washers/din_440.jpg", "/washers/din_462.jpg", "/washers/din_463.jpg", "/washers/din_5406.jpg", "/washers/din_6319.jpg", "/washers/din_6340.jpg", "/washers/din_6796.jpg", "/washers/din_6797.jpg", "/washers/din_6798.jpg", "/washers/din_6916.jpg", "/washers/din_6917.jpg", "/washers/din_6918.jpg", "/washers/din_70952.jpg", "/washers/din_7349.jpg", "/washers/din_74361.jpg", "/washers/din_7603.jpg", "/washers/din_7980.jpg", "/washers/din_7989.jpg", "/washers/din_9021.jpg", "/washers/din_93.jpg", "/washers/din_988.jpg"]);

function isStaticPath(method, url) {
    if (method.toUpperCase() !== 'GET') {
        return false;
    }
    const p = url.pathname;
    if (p.startsWith("/build/")) {
        return true;
    }
    if (p.startsWith("/assets/")) {
        return true;
    }
    if (staticPaths.has(p)) {
        return true;
    }
    if (p.endsWith('/q-data.json')) {
        const pWithoutQdata = p.replace(/\/q-data.json$/, '');
        if (staticPaths.has(pWithoutQdata + '/')) {
            return true;
        }
        if (staticPaths.has(pWithoutQdata)) {
            return true;
        }
    }
    return false;
}

export {isStaticPath};