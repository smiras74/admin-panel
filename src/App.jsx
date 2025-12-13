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
  Divider,
  Avatar,
  InputGroup,
  InputLeftElement,
  SimpleGrid,
  Container,
  Badge,
  extendTheme
} from '@chakra-ui/react';
import { CopyIcon, EmailIcon, ViewIcon, CheckIcon, CloseIcon, SearchIcon, TimeIcon, StarIcon } from '@chakra-ui/icons';

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

// --- НАСТРОЙКА ТЕМЫ ---
const theme = extendTheme({
  fonts: {
    heading: `'Inter', sans-serif`,
    body: `'Inter', sans-serif`,
  },
  colors: {
    brand: {
      50: '#E6FFFA',
      100: '#B2F5EA',
      500: '#319795',
      600: '#2C7A7B',
      900: '#234E52',
    }
  }
});

// --- КОНФИГУРАЦИЯ КОЛЛЕКЦИЙ ---
const COLLECTIONS = {
  USERS: 'users',
  WAITLIST: 'waitlist',
  MODERATION_QUEUE: 'moderation_queue',
  VERIFIED_POIS: 'verified_pois', 
};

// ------------------------------------
// 1. АУТЕНТИФИКАЦИЯ (КРАСИВЫЙ ДИЗАЙН)
// ------------------------------------
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleLogin = async () => {
    // !!! СПИСОК АДМИНОВ !!!
    const ADMIN_EMAILS = ['7715582@mail.ru', '7715582@gmail.com'];

    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        await signOut(auth);
        throw new Error("Доступ запрещен. Вы не администратор.");
      }

      toast({ status: 'success', title: 'Добро пожаловать!', description: 'Успешный вход в систему.', position: 'top' });
    } catch (error) {
      toast({ status: 'error', title: 'Ошибка входа', description: error.message, position: 'top' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex minH="100vh" align="center" justify="center" bgGradient="linear(to-br, blue.600, purple.700)">
      <Box 
        p={10} 
        w="full" 
        maxW="450px" 
        bg="white" 
        borderRadius="2xl" 
        boxShadow="2xl"
      >
        <VStack spacing={6}>
          <Box textAlign="center">
            <Heading size="xl" color="gray.700" mb={2}>Admin Panel</Heading>
            <Text color="gray.500">Guide du Détour</Text>
          </Box>
          
          <VStack spacing={4} w="full">
            <Input 
              size="lg" 
              placeholder="Email" 
              bg="gray.50"
              border="none"
              _focus={{ bg: 'white', ring: 2, ringColor: 'blue.500' }}
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
            <Input 
              size="lg" 
              type="password" 
              placeholder="Пароль" 
              bg="gray.50"
              border="none"
              _focus={{ bg: 'white', ring: 2, ringColor: 'blue.500' }}
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
            />
            <Button 
              size="lg" 
              colorScheme="blue" 
              w="full" 
              onClick={handleLogin} 
              isLoading={isLoading}
              loadingText="Вход..."
              mt={4}
              bgGradient="linear(to-r, blue.500, blue.600)"
              _hover={{ bgGradient: "linear(to-r, blue.600, blue.700)" }}
            >
              Войти в систему
            </Button>
          </VStack>
        </VStack>
      </Box>
    </Flex>
  );
};

// ------------------------------------
// 2. DASHBOARD (С КАРТОЧКАМИ)
// ------------------------------------
const StatCard = ({ label, value, diff, icon }) => (
  <Box 
    bg="white" 
    p={6} 
    borderRadius="xl" 
    boxShadow="sm" 
    borderLeft="4px solid" 
    borderColor="blue.500"
    transition="transform 0.2s"
    _hover={{ transform: 'translateY(-2px)', boxShadow: 'md' }}
  >
    <Flex justify="space-between" align="start">
      <Stat>
        <StatLabel fontSize="sm" color="gray.500" fontWeight="bold" textTransform="uppercase" letterSpacing="wide">
          {label}
        </StatLabel>
        <StatNumber fontSize="3xl" fontWeight="800" color="gray.700">
          {value}
        </StatNumber>
        {diff > 0 ? (
          <StatHelpText mb={0} color="green.500" fontWeight="bold">
            <StatArrow type='increase' />{diff} за 24ч
          </StatHelpText>
        ) : (
          <StatHelpText mb={0} color="gray.400" fontSize="xs">Нет новых за сутки</StatHelpText>
        )}
      </Stat>
      <Box p={2} bg="blue.50" borderRadius="md" color="blue.500">
        {icon}
      </Box>
    </Flex>
  </Box>
);

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
        
        let userNewCount = 0;
        try {
            const usersNewSnap = await getCountFromServer(query(collection(db, COLLECTIONS.USERS), where('timestamp', '>=', yesterdayTimestamp)));
            userNewCount = usersNewSnap.data().count;
        } catch (e) { }

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

  if (isLoading) return <Flex justify="center" p={10}><Spinner size="xl" color="blue.500" /></Flex>;

  return (
    <VStack spacing={8} align="stretch">
      <Box>
        <Heading size="lg" mb={2}>Обзор</Heading>
        <Text color="gray.500">Ключевые показатели на сегодня</Text>
      </Box>
      
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        <StatCard 
          label="Лист ожидания" 
          value={stats.waitlistTotal} 
          diff={stats.waitlistNew} 
          icon={<TimeIcon boxSize={6} />}
        />
        <StatCard 
          label="Пользователи" 
          value={stats.userTotal} 
          diff={stats.userNew} 
          icon={<StarIcon boxSize={6} />}
        />
        {/* Можно добавить еще карточки в будущем */}
      </SimpleGrid>
    </VStack>
  );
};

// ------------------------------------
// 3. ТАБЛИЦА ПОЛЬЗОВАТЕЛЕЙ
// ------------------------------------
const UsersTable = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, COLLECTIONS.USERS));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(data);
      setFilteredUsers(data);
    } catch (error) { toast({ status: 'error', title: 'Ошибка загрузки' }); } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    if (!search) {
      setFilteredUsers(users);
    } else {
      const lowerSearch = search.toLowerCase();
      const filtered = users.filter(user => 
        (user.email && user.email.toLowerCase().includes(lowerSearch)) ||
        (user.displayName && user.displayName.toLowerCase().includes(lowerSearch)) ||
        (user.name && user.name.toLowerCase().includes(lowerSearch)) ||
        user.id.includes(lowerSearch)
      );
      setFilteredUsers(filtered);
    }
  }, [search, users]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast({ status: 'success', title: 'Скопировано', duration: 1000 });
  };

  return (
    <Box bg="white" borderRadius="xl" shadow="sm" overflow="hidden">
      <Flex p={6} justify="space-between" align="center" borderBottom="1px" borderColor="gray.100" bg="gray.50">
        <Heading size="md">Пользователи <Badge ml={2} colorScheme="blue" borderRadius="full">{users.length}</Badge></Heading>
        <HStack>
            <InputGroup size="sm" w="250px">
                <InputLeftElement pointerEvents='none'><SearchIcon color='gray.400' /></InputLeftElement>
                <Input 
                placeholder="Поиск..." 
                bg="white" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                borderRadius="md"
                />
            </InputGroup>
            <Button size="sm" leftIcon={<TimeIcon />} onClick={fetchUsers} colorScheme="gray" variant="solid">Обновить</Button>
        </HStack>
      </Flex>
      
      {loading ? <Flex justify="center" p={10}><Spinner /></Flex> : (
        <Box overflowX="auto">
        <Table variant="simple">
          <Thead bg="gray.50"><Tr><Th>Пользователь</Th><Th>ID</Th><Th>Регистрация</Th><Th>Действия</Th></Tr></Thead>
          <Tbody>
            {filteredUsers.map((user) => (
              <Tr key={user.id} _hover={{ bg: "gray.50" }}>
                <Td>
                  <HStack>
                    <Avatar size="sm" name={user.displayName || user.email} src={user.photoUrl || user.photoURL} border="2px solid white" boxShadow="sm" />
                    <Box>
                        <Text fontWeight="bold" fontSize="sm">{user.displayName || user.name || 'Без имени'}</Text>
                        <Text fontSize="xs" color="gray.500">{user.email}</Text>
                    </Box>
                  </HStack>
                </Td>
                <Td>
                   <Tag size="sm" variant="subtle" colorScheme="gray" fontFamily="mono">{user.id.substring(0,8)}...</Tag>
                </Td>
                <Td fontSize="sm" color="gray.600">
                  {user.timestamp?.seconds ? new Date(user.timestamp.seconds * 1000).toLocaleDateString() : '—'}
                </Td>
                <Td>
                    <IconButton aria-label="Copy" icon={<CopyIcon />} size="sm" variant="ghost" colorScheme="blue" onClick={() => copyToClipboard(user.id)} />
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
// 4. ТАБЛИЦА ЛИСТА ОЖИДАНИЯ
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
    toast({ status: 'success', title: 'Скопировано', duration: 1000 });
  };

  return (
    <Box bg="white" borderRadius="xl" shadow="sm" overflow="hidden">
      <Flex p={6} justify="space-between" align="center" borderBottom="1px" borderColor="gray.100" bg="gray.50">
        <Heading size="md">Заявки Waitlist <Badge ml={2} colorScheme="purple" borderRadius="full">{list.length}</Badge></Heading>
        <Button size="sm" leftIcon={<TimeIcon />} onClick={fetchWaitlist}>Обновить</Button>
      </Flex>
      {loading ? <Flex justify="center" p={10}><Spinner /></Flex> : (
        <Box overflowX="auto">
        <Table variant="simple">
          <Thead bg="gray.50"><Tr><Th>Email</Th><Th>Дата</Th><Th>Действия</Th></Tr></Thead>
          <Tbody>
            {list.map((item) => (
              <Tr key={item.id} _hover={{ bg: "gray.50" }}>
                <Td fontWeight="bold" color="gray.700">{item.email}</Td>
                <Td fontSize="sm" color="gray.500">
                  {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('ru-RU') : '—'}
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Tooltip label="Копировать"><IconButton aria-label="Copy" icon={<CopyIcon />} size="sm" variant="ghost" onClick={() => copyToClipboard(item.email)} /></Tooltip>
                    <Tooltip label="Написать"><IconButton aria-label="Write" as="a" href={`mailto:${item.email}`} icon={<EmailIcon />} size="sm" colorScheme="blue" variant="solid" /></Tooltip>
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
// 5. МОДЕРАЦИЯ И СРАВНЕНИЕ
// =================================================================

const DiffRow = ({ label, oldVal, newVal }) => {
  const isDifferent = oldVal !== newVal && newVal !== undefined && newVal !== null && newVal !== '';
  if ((!oldVal && !newVal) || (oldVal === undefined && newVal === undefined)) return null;
  return (
    <Tr bg={isDifferent ? "green.50" : "transparent"}>
      <Td fontWeight="bold" w="200px" color="gray.600">{label}</Td>
      <Td color="gray.500" fontSize="sm"><Text noOfLines={4}>{oldVal ? oldVal.toString() : '—'}</Text></Td>
      <Td fontWeight={isDifferent ? "bold" : "normal"} color={isDifferent ? "green.700" : "black"}>
         <Text noOfLines={4}>{newVal ? newVal.toString() : '—'}</Text>
         {isDifferent && <Tag size="sm" colorScheme="green" ml={2} mt={1}>Изменено</Tag>}
      </Td>
    </Tr>
  );
};

const ReviewModal = ({ isOpen, onClose, proposal, onProcess }) => {
  const [originalDoc, setOriginalDoc] = useState(null);
  const [loadingOriginal, setLoadingOriginal] = useState(false);

  useEffect(() => {
    if (isOpen && proposal && proposal.type !== 'new_poi' && proposal.poiId) {
      setLoadingOriginal(true);
      const fetchOriginal = async () => {
        try {
            const docRef = doc(db, COLLECTIONS.VERIFIED_POIS, proposal.poiId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) { setOriginalDoc(docSnap.data()); } 
            else { setOriginalDoc({ error: "Не найдено" }); }
        } catch (e) { setOriginalDoc({ error: "Ошибка" }); } 
        finally { setLoadingOriginal(false); }
      };
      fetchOriginal();
    } else { setOriginalDoc(null); }
  }, [isOpen, proposal]);

  if (!proposal) return null;
  const isNew = proposal.type === 'new_poi';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="4xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent borderRadius="xl" overflow="hidden">
        <ModalHeader bg="gray.50" borderBottom="1px" borderColor="gray.100">
            Обзор предложения {isNew ? <Tag ml={2} colorScheme="blue">Новая точка</Tag> : <Tag ml={2} colorScheme="orange">Изменение</Tag>}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          <VStack align="start" spacing={6}>
            <Box w="full" bg="blue.50" p={4} borderRadius="md" borderLeft="4px solid" borderColor="blue.400">
                <Text fontSize="xs" fontWeight="bold" color="blue.500" textTransform="uppercase">Метаданные</Text>
                <SimpleGrid columns={2} spacing={4} mt={2}>
                    <Box><Text fontSize="xs" color="gray.500">ID Заявки</Text><Text fontSize="sm" fontFamily="mono">{proposal.id}</Text></Box>
                    <Box><Text fontSize="xs" color="gray.500">ID Автора</Text><Text fontSize="sm" fontFamily="mono">{proposal.userId}</Text></Box>
                </SimpleGrid>
            </Box>
            
            {loadingOriginal ? <Flex w="full" justify="center" p={10}><Spinner /></Flex> : (
              <Table variant="simple" size="md" border="1px" borderColor="gray.200" borderRadius="md">
                <Thead bg="gray.50"><Tr><Th>Поле</Th><Th>Было</Th><Th>Стало</Th></Tr></Thead>
                <Tbody>
                  <DiffRow label="Название" oldVal={originalDoc?.name} newVal={proposal.suggestedName || proposal.suggestedNameNew} />
                  <DiffRow label="Описание" oldVal={originalDoc?.description} newVal={proposal.suggestedDescription} />
                  <DiffRow label="Категория" oldVal={originalDoc?.category} newVal={proposal.suggestedCategory} />
                  <DiffRow label="Тип" oldVal={originalDoc?.type} newVal={proposal.suggestedType} />
                  <DiffRow label="Широта" oldVal={originalDoc?.latitude} newVal={proposal.latitude} />
                  <DiffRow label="Долгота" oldVal={originalDoc?.longitude} newVal={proposal.longitude} />
                   {isNew && <Tr><Td colSpan={3} bg="blue.50" textAlign="center" color="gray.500" py={8}>Это новая точка. Нет предыдущей версии.</Td></Tr>}
                </Tbody>
              </Table>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter bg="gray.50" borderTop="1px" borderColor="gray.100">
            <HStack spacing={4}>
                <Button variant="ghost" onClick={onClose}>Закрыть</Button>
                <Button leftIcon={<CloseIcon />} colorScheme="red" variant="outline" onClick={() => onProcess(proposal.id, 'rejected')}>Отклонить</Button>
                <Button leftIcon={<CheckIcon />} colorScheme="green" onClick={() => onProcess(proposal.id, 'approved')}>Одобрить и Публиковать</Button>
            </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

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

  const handleProcess = async (id, status) => {
    try {
      await updateDoc(doc(db, COLLECTIONS.MODERATION_QUEUE, id), { status });
      setProposals(prev => prev.filter(p => p.id !== id));
      toast({ status: 'success', title: status === 'approved' ? 'Одобрено' : 'Отклонено' });
      onClose();
    } catch (e) { toast({ status: 'error', title: 'Ошибка' }); }
  };

  const handleReview = (proposal) => {
      setSelectedProposal(proposal);
      onOpen();
  }

  return (
    <Box bg="white" borderRadius="xl" shadow="sm" overflow="hidden">
      <Flex p={6} justify="space-between" align="center" borderBottom="1px" borderColor="gray.100" bg="gray.50">
        <Heading size="md">Модерация <Badge ml={2} colorScheme="orange" borderRadius="full">{proposals.length}</Badge></Heading>
        <Button size="sm" leftIcon={<TimeIcon />} onClick={fetchProposals}>Обновить</Button>
      </Flex>
      {loading ? <Flex justify="center" p={10}><Spinner /></Flex> : proposals.length === 0 ? <Flex p={10} justify="center" color="gray.500" bg="white">Очередь пуста. Вы молодец! 🎉</Flex> : (
        <Table variant="simple">
          <Thead bg="gray.50"><Tr><Th>Название</Th><Th>Тип</Th><Th textAlign="center">Действия</Th></Tr></Thead>
          <Tbody>
            {proposals.map(p => (
              <Tr key={p.id} _hover={{ bg: "gray.50" }}>
                <Td fontWeight="medium" fontSize="md">{p.suggestedName || p.suggestedNameNew || '—'}</Td>
                <Td>{p.type === 'new_poi' ? <Tag size="sm" colorScheme="blue" variant="solid">Новое место</Tag> : <Tag size="sm" colorScheme="orange" variant="solid">Правка</Tag>}</Td>
                <Td textAlign="center">
                  <HStack justify="center" spacing={2}>
                    <Button leftIcon={<ViewIcon />} colorScheme="teal" variant="ghost" size="sm" onClick={() => handleReview(p)}>Обзор</Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}
      <ReviewModal isOpen={isOpen} onClose={onClose} proposal={selectedProposal} onProcess={handleProcess} />
    </Box>
  );
};

// ------------------------------------
// 6. ГЛАВНОЕ МЕНЮ (НАВИГАЦИЯ)
// ------------------------------------
const AdminPanel = ({ user }) => {
  return (
    <Box minH="100vh" bg="gray.100" fontFamily="Inter">
      {/* Верхняя панель */}
      <Flex bg="white" borderBottom="1px" borderColor="gray.200" px={8} py={4} justify="space-between" align="center" shadow="sm" position="sticky" top={0} zIndex={100}>
        <HStack spacing={3}>
           <Box bgGradient="linear(to-br, blue.500, purple.600)" w={8} h={8} borderRadius="lg" />
           <Heading size="md" color="gray.800">Guide Admin</Heading>
        </HStack>
        
        <HStack spacing={4}>
          <HStack spacing={3} display={{ base: 'none', md: 'flex' }}>
              <Avatar size="sm" name={user.email} src={user.photoURL} />
              <VStack align="start" spacing={0}>
                  <Text fontSize="sm" fontWeight="bold" color="gray.700">Администратор</Text>
                  <Text fontSize="xs" color="gray.500">{user.email}</Text>
              </VStack>
          </HStack>
          <Divider orientation="vertical" h="30px" />
          <Button size="sm" colorScheme="gray" onClick={() => signOut(auth)}>Выход</Button>
        </HStack>
      </Flex>
      
      {/* Контент */}
      <Container maxW="container.xl" py={8}>
        <Tabs variant="soft-rounded" colorScheme="blue" isLazy>
          <TabList mb={6} overflowX="auto" py={2}>
            <Tab fontWeight="bold">Главная</Tab>
            <Tab fontWeight="bold">Пользователи</Tab>
            <Tab fontWeight="bold">Лист ожидания</Tab>
            <Tab fontWeight="bold">Модерация</Tab>
          </TabList>
          
          <TabPanels>
            <TabPanel px={0}><Dashboard /></TabPanel>
            <TabPanel px={0}><UsersTable /></TabPanel>
            <TabPanel px={0}><WaitlistTable /></TabPanel>
            <TabPanel px={0}><ModerationTable /></TabPanel>
          </TabPanels>
        </Tabs>
      </Container>
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

  if (loading) return <Flex minH="100vh" justify="center" align="center" bg="gray.50"><Spinner size="xl" color="blue.500" thickness="4px" /></Flex>;

  return (
    <ChakraProvider theme={theme}>
      {user ? <AdminPanel user={user} /> : <AuthScreen />}
    </ChakraProvider>
  );
}

export default App;
