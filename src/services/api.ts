import axios from 'axios';

export const api = axios.create({
    baseURL: "https://pos-nest-k5pm.onrender.com/api",
});