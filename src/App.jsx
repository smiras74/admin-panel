// src/App.jsx

import React, { useState, useEffect } from 'react';
import {
  ChakraProvider,
  Box,
  Flex,
  Heading,
  VStack,
  HStack,
  Text,
  Button,
  Input,
  useToast,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  StatArrow,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tooltip,
  IconButton
} from '@chakra-ui/react';
import { CopyIcon, EmailIcon } from '@chakra-ui/icons';

import {
  db,
  auth
} from './firebaseConfig';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  collection,
  query,
  getDocs,
  where,
  updateDoc,
  doc,
  getCountFromServer,
  Timestamp
} from 'firebase/firestore';


const COLLECTIONS = {
  USERS: 'users',
  WAITLIST: 'waitlist',
  MODERATION_QUEUE: 'moderation_queue',
};

// ------------------------------------
// 1. АУТЕНТИФИКАЦИЯ
// ------------------------------------
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({ status: 'success', title: 'Вход выполнен' });
    } catch (error) {
      toast({ status: 'error', title: 'Ошибка входа', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bg="gray.50">
      <Box p={8} maxW="400px" borderWidth={1} borderRadius={8} boxShadow="lg" bg="white">
        <Heading mb={6} textAlign="center">Вход в Админку</Heading>
        <VStack spacing={4}>
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button colorScheme="blue" w="full" onClick={handleLogin} isLoading={isLoading}>Войти</Button>
        </VStack>
      </Box>
    </Flex>
  );
};

// ------------------------------------
// 2. DASHBOARD (С НОВЫМИ СЧЕТЧИКАМИ)
// ------------------------------------
const Dashboard = () => {
  const [stats, setStats] = useState({ 
    waitlistTotal: 0, 
    waitlistNew: 0,
    userTotal: 0,
    userNew: 0 
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Вычисляем время "24 часа назад"
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayTimestamp = Timestamp.fromDate(yesterday);

        // 1. Лист ожидания (Всего)
        const waitlistTotalSnap = await getCountFromServer(collection(db, COLLECTIONS.WAITLIST));
        
        // 2. Лист ожидания (Новые за 24ч)
        const waitlistNewQuery = query(
          collection(db, COLLECTIONS.WAITLIST), 
          where('timestamp', '>=', yesterdayTimestamp)
        );
        const waitlistNewSnap = await getCountFromServer(waitlistNewQuery);

        // 3. Пользователи (Всего)
        const usersTotalSnap = await getCountFromServer(collection(db, COLLECTIONS.USERS));

        // 4. Пользователи (Новые за 24ч)
        // Примечание: Это сработает, если у пользователей в базе есть поле 'timestamp' или 'createdAt'
        // Если поле называется иначе, здесь будет 0.
        const usersNewQuery = query(
          collection(db, COLLECTIONS.USERS), 
          where('timestamp', '>=', yesterdayTimestamp)
        );
        const usersNewSnap = await getCountFromServer(usersNewQuery);

        setStats({
          waitlistTotal: waitlistTotalSnap.data().count,
          waitlistNew: waitlistNewSnap.data().count,
          userTotal: usersTotalSnap.data().count,
          userNew: usersNewSnap.data().count,
        });

      } catch (e) {
        console.error("Ошибка загрузки статистики:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) return <Spinner />;

  return (
    <HStack spacing={8} p={4} align="start">
      {/* Карточка Листа Ожидания */}
      <Stat p={5} shadow="md" border="1px" borderColor="gray.200" borderRadius="md" bg="white">
        <StatLabel fontSize="lg" color="gray.500">Лист ожидания</StatLabel>
        <Flex align="baseline" mt={2}>
          <StatNumber fontSize="4xl">{stats.waitlistTotal}</StatNumber>
          {stats.waitlistNew > 0 && (
            <StatHelpText ml={2} mb={0} color="green.500" fontWeight="bold">
              <StatArrow type='increase' />
              {stats.waitlistNew} за 24ч
            </StatHelpText>
          )}
        </Flex>
        {stats.waitlistNew === 0 && <Text fontSize="sm" color="gray.400">Нет новых за сутки</Text>}
      </Stat>

      {/* Карточка Пользователей */}
      <Stat p={5} shadow="md" border="1px" borderColor="gray.200" borderRadius="md" bg="white">
        <StatLabel fontSize="lg" color="gray.500">Пользователи</StatLabel>
        <Flex align="baseline" mt={2}>
          <StatNumber fontSize="4xl">{stats.userTotal}</StatNumber>
          {stats.userNew > 0 && (
            <StatHelpText ml={2} mb={0} color="green.500" fontWeight="bold">
              <StatArrow type='increase' />
              {stats.userNew} за 24ч
            </StatHelpText>
          )}
        </Flex>
        {stats.userNew === 0 && <Text fontSize="sm" color="gray.400">Нет новых за сутки</Text>}
      </Stat>
    </HStack>
  );
};

// ------------------------------------
// 3. ТАБЛИЦА ЛИСТА ОЖИДАНИЯ
// ------------------------------------
const WaitlistTable = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, COLLECTIONS.WAITLIST));
      const snapshot = await getDocs(q);
      
      // Сортируем вручную по дате (новые сверху), чтобы не требовать сложный индекс Firestore
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => {
        const dateA = a.timestamp?.seconds || 0;
        const dateB = b.timestamp?.seconds || 0;
        return dateB - dateA; // По убыванию
      });
      
      setList(data);
    } catch (error) {
      console.error(error);
      toast({ status: 'error', title: 'Ошибка загрузки', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchWaitlist(); }, []);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ status: 'success', title: 'Скопировано', duration: 1000, position: 'top' });
  };

  return (
    <Box p={4}>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Заявки ({list.length})</Heading>
        <Button size="sm" onClick={fetchWaitlist}>Обновить</Button>
      </HStack>
      
      {loading ? <Spinner /> : (
        <Box overflowX="auto">
        <Table variant="simple" size="sm">
          <Thead><Tr><Th>Email</Th><Th>Дата</Th><Th>Действия</Th></Tr></Thead>
          <Tbody>
            {list.map((item) => (
              <Tr key={item.id}>
                <Td fontWeight="bold">{item.email}</Td>
                <Td fontSize="xs" color="gray.500">
                  {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('ru-RU') : '—'}
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Tooltip label="Копировать">
                      <IconButton 
                        icon={<CopyIcon />} 
                        size="sm" 
                        variant="ghost"
                        onClick={() => copyToClipboard(item.email)} 
                      />
                    </Tooltip>
                    <Tooltip label="Написать письмо">
                      <IconButton 
                        as="a" 
                        href={`mailto:${item.email}`}
                        icon={<EmailIcon />} 
                        size="sm" 
                        colorScheme="blue"
                        variant="ghost"
                      />
                    </Tooltip>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
        </Box>
      )}
    </Box>
  );
};

// ------------------------------------
// 4. МОДЕРАЦИЯ
// ------------------------------------
const ModerationTable = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const fetchProposals = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, COLLECTIONS.MODERATION_QUEUE), where('status', '==', 'pending'));
      const snapshot = await getDocs(q);
      setProposals(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchProposals(); }, []);

  const handleStatus = async (id, status) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.MODERATION_QUEUE, id), { status });
      setProposals(prev => prev.filter(p => p.id !== id));
      toast({ status: 'success', title: status === 'approved' ? 'Одобрено' : 'Отклонено' });
    } catch (e) { toast({ status: 'error', title: 'Ошибка' }); }
  };

  return (
    <Box p={4}>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Очередь Модерации</Heading>
        <Button size="sm" onClick={fetchProposals}>Обновить</Button>
      </HStack>
      {loading ? <Spinner /> : proposals.length === 0 ? <Text color="gray.500">Очередь пуста</Text> : (
        <Table variant="simple" size="sm">
          <Thead><Tr><Th>Название</Th><Th>Тип</Th><Th>Действия</Th></Tr></Thead>
          <Tbody>
            {proposals.map(p => (
              <Tr key={p.id}>
                <Td>{p.suggestedName || p.suggestedNameNew}</Td>
                <Td>{p.type === 'new_poi' ? 'Новое' : 'Правка'}</Td>
                <Td>
                  <Button size="xs" colorScheme="green" mr={2} onClick={() => handleStatus(p.id, 'approved')}>Да</Button>
                  <Button size="xs" colorScheme="red" onClick={() => handleStatus(p.id, 'rejected')}>Нет</Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
    </Box>
  );
};

// ------------------------------------
// 5. ГЛАВНОЕ МЕНЮ
// ------------------------------------
const AdminPanel = ({ user }) => {
  return (
    <Box minH="100vh" bg="gray.50">
      <Flex bg="blue.600" color="white" px={6} py={4} justify="space-between" align="center" shadow="md">
        <Heading size="md">Guide du Détour Admin</Heading>
        <HStack>
          <Text fontSize="sm" opacity={0.8}>{user.email}</Text>
          <Button size="sm" colorScheme="whiteAlpha" variant="outline" onClick={() => signOut(auth)}>Выход</Button>
        </HStack>
      </Flex>
      
      <Box p={6}>
        <Tabs variant="soft-rounded" colorScheme="blue" isLazy>
          <TabList mb={6}>
            <Tab>Главная</Tab>
            <Tab>Лист ожидания</Tab>
            <Tab>Модерация</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel px={0}><Dashboard /></TabPanel>
            <TabPanel px={0} bg="white" p={4} borderRadius="md" shadow="sm"><WaitlistTable /></TabPanel>
            <TabPanel px={0} bg="white" p={4} borderRadius="md" shadow="sm"><ModerationTable /></TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Box>
  );
};

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <Flex minH="100vh" justify="center" align="center"><Spinner size="xl" color="blue.500" /></Flex>;

  return (
    <ChakraProvider>
      {user ? <AdminPanel user={user} /> : <AuthScreen />}
    </ChakraProvider>
  );
}

export default App;
