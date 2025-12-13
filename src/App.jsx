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
  IconButton,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  useDisclosure,
  Tag,
  Divider
} from '@chakra-ui/react';
import { CopyIcon, EmailIcon, ViewIcon, CheckIcon, CloseIcon } from '@chakra-ui/icons';

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
  getDoc,
  where,
  updateDoc,
  doc,
  getCountFromServer,
  Timestamp
} from 'firebase/firestore';


// --- КОНФИГУРАЦИЯ КОЛЛЕКЦИЙ ---
const COLLECTIONS = {
  USERS: 'users',
  WAITLIST: 'waitlist',
  MODERATION_QUEUE: 'moderation_queue',
  // ВАЖНО: Убедитесь, что название коллекции с реальными точками правильное
  VERIFIED_POIS: 'verified_pois', 
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
// 2. DASHBOARD
// ------------------------------------
const Dashboard = () => {
  const [stats, setStats] = useState({ waitlistTotal: 0, waitlistNew: 0, userTotal: 0, userNew: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayTimestamp = Timestamp.fromDate(yesterday);

        const waitlistTotalSnap = await getCountFromServer(collection(db, COLLECTIONS.WAITLIST));
        const waitlistNewSnap = await getCountFromServer(query(collection(db, COLLECTIONS.WAITLIST), where('timestamp', '>=', yesterdayTimestamp)));
        const usersTotalSnap = await getCountFromServer(collection(db, COLLECTIONS.USERS));
        // Для подсчета новых юзеров нужно поле timestamp в коллекции users
        let userNewCount = 0;
        try {
            const usersNewSnap = await getCountFromServer(query(collection(db, COLLECTIONS.USERS), where('timestamp', '>=', yesterdayTimestamp)));
            userNewCount = usersNewSnap.data().count;
        } catch (e) { console.log("Нет поля timestamp у юзеров для подсчета новых"); }

        setStats({
          waitlistTotal: waitlistTotalSnap.data().count,
          waitlistNew: waitlistNewSnap.data().count,
          userTotal: usersTotalSnap.data().count,
          userNew: userNewCount,
        });

      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchStats();
  }, []);

  if (isLoading) return <Spinner />;

  return (
    <HStack spacing={8} p={4} align="start">
      <Stat p={5} shadow="md" border="1px" borderColor="gray.200" borderRadius="md" bg="white">
        <StatLabel fontSize="lg" color="gray.500">Лист ожидания</StatLabel>
        <Flex align="baseline" mt={2}>
          <StatNumber fontSize="4xl">{stats.waitlistTotal}</StatNumber>
          {stats.waitlistNew > 0 && (
            <StatHelpText ml={2} mb={0} color="green.500" fontWeight="bold">
              <StatArrow type='increase' />{stats.waitlistNew} за 24ч
            </StatHelpText>
          )}
        </Flex>
      </Stat>
      <Stat p={5} shadow="md" border="1px" borderColor="gray.200" borderRadius="md" bg="white">
        <StatLabel fontSize="lg" color="gray.500">Пользователи</StatLabel>
        <Flex align="baseline" mt={2}>
          <StatNumber fontSize="4xl">{stats.userTotal}</StatNumber>
          {stats.userNew > 0 && (
            <StatHelpText ml={2} mb={0} color="green.500" fontWeight="bold">
              <StatArrow type='increase' />{stats.userNew} за 24ч
            </StatHelpText>
          )}
        </Flex>
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
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
      setList(data);
    } catch (error) { toast({ status: 'error', title: 'Ошибка загрузки' }); } finally { setLoading(false); }
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
                    <IconButton icon={<CopyIcon />} size="sm" variant="ghost" onClick={() => copyToClipboard(item.email)} aria-label="Copy" />
                    <IconButton as="a" href={`mailto:${item.email}`} icon={<EmailIcon />} size="sm" colorScheme="blue" variant="ghost" aria-label="Email" />
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

// =================================================================
// НОВЫЕ КОМПОНЕНТЫ ДЛЯ СРАВНЕНИЯ (DIFF)
// =================================================================

// Вспомогательный компонент строки сравнения: подсвечивает разницу
const DiffRow = ({ label, oldVal, newVal }) => {
  // Считаем значение измененным, если оно отличается и новое значение не пустое
  const isDifferent = oldVal !== newVal && newVal !== undefined && newVal !== null && newVal !== '';

  // Если оба значения пусты, не показываем строку
  if ((!oldVal && !newVal) || (oldVal === undefined && newVal === undefined)) return null;

  return (
    <Tr bg={isDifferent ? "green.50" : "transparent"}>
      <Td fontWeight="bold" w="200px" color="gray.600">{label}</Td>
      <Td color="gray.500" fontSize="sm">
        <Text noOfLines={4} title={oldVal}>{oldVal !== undefined && oldVal !== null && oldVal !== '' ? oldVal.toString() : '—'}</Text>
      </Td>
      <Td fontWeight={isDifferent ? "bold" : "normal"} color={isDifferent ? "green.700" : "black"}>
         <Text noOfLines={4} title={newVal}>{newVal !== undefined && newVal !== null && newVal !== '' ? newVal.toString() : '—'}</Text>
         {isDifferent && <Tag size="sm" colorScheme="green" ml={2} mt={1}>Изменено</Tag>}
      </Td>
    </Tr>
  );
};


// Модальное окно обзора и сравнения
const ReviewModal = ({ isOpen, onClose, proposal, onProcess }) => {
  const [originalDoc, setOriginalDoc] = useState(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);

  // При открытии окна, если это РЕДАКТИРОВАНИЕ, загружаем оригинал
  useEffect(() => {
    if (isOpen && proposal && proposal.type !== 'new_poi' && proposal.poiId) {
      setLoadingOriginal(true);
      const fetchOriginal = async () => {
        try {
            // ВАЖНО: Используем ID из поля proposal.poiId для поиска в коллекции VERIFIED_POIS
            const docRef = doc(db, COLLECTIONS.VERIFIED_POIS, proposal.poiId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                setOriginalDoc(docSnap.data());
            } else {
                setOriginalDoc({ error: "Оригинальный документ не найден" });
            }
        } catch (e) {
            console.error("Ошибка при загрузке оригинала:", e);
            setOriginalDoc({ error: "Ошибка загрузки" });
        } finally {
            setLoadingOriginal(false);
        }
      };
      fetchOriginal();
    } else {
        // Сброс при закрытии или если это новая точка
        setOriginalDoc(null);
    }
  }, [isOpen, proposal]);


  if (!proposal) return null;

  const isNew = proposal.type === 'new_poi';
  const isEdit = !isNew;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
            Обзор предложения
            {isNew ? <Tag ml={2} colorScheme="blue">Новая точка</Tag> : <Tag ml={2} colorScheme="orange">Изменение</Tag>}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack align="start" spacing={4}>
            <Box>
                <Text fontWeight="bold">ID Предложения:</Text> <Text fontSize="sm" fontFamily="mono">{proposal.id}</Text>
                {isEdit && <><Text fontWeight="bold" mt={2}>ID Оригинальной точки:</Text> <Text fontSize="sm" fontFamily="mono">{proposal.poiId}</Text></>}
                <Text fontWeight="bold" mt={2}>Автор (User ID):</Text> <Text fontSize="sm" fontFamily="mono">{proposal.userId}</Text>
            </Box>
            
            <Divider />

            {loadingOriginal ? (
               <Flex w="full" justify="center" p={10}><Spinner label="Загрузка оригинала..." /></Flex>
            ) : (
              <Table variant="simple" size="md" border="1px" borderColor="gray.200">
                <Thead bg="gray.100">
                  <Tr>
                    <Th>Поле</Th>
                    <Th>Было (Оригинал)</Th>
                    <Th>Стало (Предложение)</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {/* ВАЖНО: Здесь мы сопоставляем поля. 
                      Слева (oldVal) - как поле называется в реальной базе (originalDoc).
                      Справа (newVal) - как поле называется в заявке на модерацию (proposal).
                      Подправьте названия полей (например, 'name' или 'description'), если они отличаются в вашей базе.
                  */}
                  <DiffRow 
                    label="Название" 
                    oldVal={originalDoc?.name} // Предполагаем, что в оригинале поле называется 'name'
                    newVal={proposal.suggestedName || proposal.suggestedNameNew} // В заявке 'suggestedName'
                  />
                  <DiffRow 
                    label="Описание" 
                    oldVal={originalDoc?.description} 
                    newVal={proposal.suggestedDescription} 
                  />
                   <DiffRow 
                    label="Категория" 
                    oldVal={originalDoc?.category} 
                    newVal={proposal.suggestedCategory} 
                  />
                  <DiffRow 
                    label="Тип" 
                    oldVal={originalDoc?.type} 
                    newVal={proposal.suggestedType} 
                  />
                   <DiffRow 
                    label="Широта (Lat)" 
                    oldVal={originalDoc?.latitude} 
                    newVal={proposal.latitude} 
                  />
                   <DiffRow 
                    label="Долгота (Lng)" 
                    oldVal={originalDoc?.longitude} 
                    newVal={proposal.longitude} 
                  />
                   {/* Для новых точек, где нет оригинала, просто покажем предложенные данные */}
                   {isNew && (
                     <Tr>
                       <Td colSpan={3} bg="blue.50" textAlign="center" color="gray.500" fontSize="sm">
                         Это новая точка. Данных "Было" нет.
                       </Td>
                     </Tr>
                   )}
                </Tbody>
              </Table>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter bg="gray.50">
            <HStack spacing={4}>
                <Button variant="ghost" onClick={onClose}>Закрыть</Button>
                <Button leftIcon={<CloseIcon />} colorScheme="red" onClick={() => onProcess(proposal.id, 'rejected')}>Отклонить</Button>
                <Button leftIcon={<CheckIcon />} colorScheme="green" onClick={() => onProcess(proposal.id, 'approved')}>Одобрить</Button>
            </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};


// ------------------------------------
// 4. МОДЕРАЦИЯ (С кнопкой Обзора)
// ------------------------------------
const ModerationTable = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
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

  // Функция обработки (Одобрить/Отклонить), передается в модальное окно
  const handleProcess = async (id, status) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.MODERATION_QUEUE, id), { status });
      setProposals(prev => prev.filter(p => p.id !== id));
      toast({ status: 'success', title: status === 'approved' ? 'Одобрено' : 'Отклонено' });
      onClose(); // Закрываем окно после обработки
    } catch (e) { toast({ status: 'error', title: 'Ошибка при обработке' }); }
  };

  // Открытие окна обзора
  const handleReview = (proposal) => {
      setSelectedProposal(proposal);
      onOpen();
  }

  return (
    <Box p={4}>
      <HStack justify="space-between" mb={4}>
        <Heading size="md">Очередь Модерации ({proposals.length})</Heading>
        <Button size="sm" onClick={fetchProposals}>Обновить</Button>
      </HStack>
      {loading ? <Spinner /> : proposals.length === 0 ? <Text color="gray.500">Очередь пуста. Хорошая работа!</Text> : (
        <Table variant="simple" size="sm">
          <Thead><Tr><Th>Название</Th><Th>Тип</Th><Th textAlign="center">Действия</Th></Tr></Thead>
          <Tbody>
            {proposals.map(p => (
              <Tr key={p.id}>
                <Td fontWeight="medium">{p.suggestedName || p.suggestedNameNew || '—'}</Td>
                <Td>
                    {p.type === 'new_poi' ? <Tag size="sm" colorScheme="blue">Новое</Tag> : <Tag size="sm" colorScheme="orange">Правка</Tag>}
                </Td>
                <Td textAlign="center">
                  <HStack justify="center" spacing={2}>
                    <Tooltip label="Обзор и Сравнение">
                        <IconButton icon={<ViewIcon />} colorScheme="teal" size="sm" onClick={() => handleReview(p)} aria-label="Review" />
                    </Tooltip>
                    {/* Кнопки быстрого действия тоже оставим */}
                    <IconButton icon={<CheckIcon />} colorScheme="green" variant="outline" size="sm" onClick={() => handleProcess(p.id, 'approved')} aria-label="Approve" />
                    <IconButton icon={<CloseIcon />} colorScheme="red" variant="outline" size="sm" onClick={() => handleProcess(p.id, 'rejected')} aria-label="Reject" />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      
      {/* Модальное окно, которое открывается по кнопке Обзор */}
      <ReviewModal 
        isOpen={isOpen} 
        onClose={onClose} 
        proposal={selectedProposal} 
        onProcess={handleProcess}
      />
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
