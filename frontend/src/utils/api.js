import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

export const loginUser = (name) => API.post('/users', { name });
export const updateScore = (name, game, scoreData) => API.put(`/scores/${name}/${game}`, { scoreData });