import http from 'k6/http';
import { sleep, check } from 'k6';

export let options = {
    stages: [
        { duration: '7s', target: 1000 },
        { duration: '7s', target: 1000 },
        { duration: '7s', target: 0 },
    ],
};

export default function () {
    let response = http.get('https://menu.artme.dev/sites/1');

    check(response, {
        'is status 200': (r) => r.status === 200,
        'response time is less than 2000ms': (r) => r.timings.duration < 2000,
    });

    sleep(1);
};
