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
  FormControl,
  FormLabel,
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Tag,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Textarea,
  IconButton,
  Tooltip
} from '@chakra-ui/react';
import { CopyIcon, EmailIcon } from '@chakra-ui/icons'; // Импортируем иконки

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
  orderBy
} from 'firebase/firestore';


const COLLECTIONS = {
  USERS: 'users',
  WAITLIST: 'waitlist',
  MODERATION_QUEUE: 'moderation_queue',
};

// ------------------------------------
// 1. КОМПОНЕНТ: АУТЕНТИФИКАЦИЯ
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
// 2. КОМПОНЕНТ: DASHBOARD (Счетчики)
// ------------------------------------
const Dashboard = () => {
  const [stats, setStats] = useState({ waitlistCount: 0, userCount: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const wCount = await getCountFromServer(collection(db, COLLECTIONS.WAITLIST));
        const uCount = await getCountFromServer(collection(db, COLLECTIONS.USERS));
        setStats({ waitlistCount: wCount.data().count, userCount: uCount.data().count });
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) return <Spinner />;

  return (
    <HStack spacing={8} p={4}>
      <Stat p={5} shadow="md" border="1px" borderColor="gray.200" borderRadius="md">
        <StatLabel>Лист ожидания</StatLabel>
        <StatNumber>{stats.waitlistCount}</StatNumber>
      </Stat>
      <Stat p={5} shadow="md" border="1px" borderColor="gray.200" borderRadius="md">
        <StatLabel>Пользователи</StatLabel>
        <StatNumber>{stats.userCount}</StatNumber>
      </Stat>
    </HStack>
  );
};

// ------------------------------------
// 3. НОВЫЙ КОМПОНЕНТ: ТАБЛИЦА ЛИСТА ОЖИДАНИЯ
// ------------------------------------
const WaitlistTable = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchWaitlist = async () => {
    setLoading(true);
    try {
      // Пытаемся получить список. Если нет поля timestamp, сортировка может не сработать,
      // поэтому можно убрать orderBy если будет ошибка индексов.
      const q = query(collection(db, COLLECTIONS.WAITLIST)); 
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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
    toast({ status: 'success', title: 'Скопировано!', duration: 1000 });
  };

  return (
    <Box p={4}>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Заявки в Лист Ожидания</Heading>
        <Button size="sm" onClick={fetchWaitlist}>Обновить</Button>
      </HStack>
      
      {loading ? <Spinner /> : (
        <Table variant="simple" size="sm">
          <Thead><Tr><Th>Email</Th><Th>Дата</Th><Th>Действия</Th></Tr></Thead>
          <Tbody>
            {list.map((item) => (
              <Tr key={item.id}>
                <Td fontWeight="bold">{item.email}</Td>
                <Td fontSize="xs" color="gray.500">
                  {/* Если есть timestamp, преобразуем в дату, иначе просто ID */}
                  {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : '—'}
                </Td>
                <Td>
                  <HStack>
                    <Tooltip label="Копировать Email">
                      <IconButton 
                        icon={<CopyIcon />} 
                        size="sm" 
                        onClick={() => copyToClipboard(item.email)} 
                      />
                    </Tooltip>
                    <Tooltip label="Отправить письмо">
                      <IconButton 
                        as="a" 
                        href={`mailto:${item.email}?subject=Приглашение в Guide du Détour&body=Здравствуйте! Добро пожаловать...`}
                        icon={<EmailIcon />} 
                        size="sm" 
                        colorScheme="blue"
                      />
                    </Tooltip>
                  </HStack>
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
// 4. КОМПОНЕНТ: МОДЕРАЦИЯ (Остался прежним, сокращен для удобства)
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
        <Heading size="md">Модерация</Heading>
        <Button size="sm" onClick={fetchProposals}>Обновить</Button>
      </HStack>
      {loading ? <Spinner /> : (
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
// 5. ГЛАВНАЯ СТРАНИЦА
// ------------------------------------
const AdminPanel = ({ user }) => {
  return (
    <Box>
      <Flex bg="blue.600" color="white" p={4} justify="space-between" align="center">
        <Heading size="md">Admin Panel</Heading>
        <Button size="sm" colorScheme="red" onClick={() => signOut(auth)}>Выход</Button>
      </Flex>
      <Box p={4}>
        <Tabs variant="enclosed">
          <TabList>
            <Tab>Дашборд</Tab>
            <Tab>Лист ожидания</Tab>
            <Tab>Модерация</Tab>
          </TabList>
          <TabPanels>
            <TabPanel><Dashboard /></TabPanel>
            <TabPanel><WaitlistTable /></TabPanel>
            <TabPanel><ModerationTable /></TabPanel>
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

  if (loading) return <Flex minH="100vh" justify="center" align="center"><Spinner /></Flex>;

  return (
    <ChakraProvider>
      {user ? <AdminPanel user={user} /> : <AuthScreen />}
    </ChakraProvider>
  );
}

export default App;
