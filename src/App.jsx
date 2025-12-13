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
  extendTheme,
  Image
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

// --- ТЕМА DARK LIQUID GLASS ---
const theme = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
  fonts: {
    heading: `'Georgia', serif`, // Шрифт с засечками как на логотипе
    body: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif`,
  },
  styles: {
    global: {
      body: {
        // Темный градиент как на заставке приложения
        bgImage: "linear-gradient(to bottom, #1A2639, #050505)", 
        bgAttachment: "fixed",
        color: "white",
      }
    }
  },
  colors: {
    brand: {
        green: "#48BB78", // Зеленый акцент из логотипа
        darkGlass: "rgba(20, 25, 40, 0.6)", // Цвет стекла
    }
  },
  components: {
    Button: {
      baseStyle: { borderRadius: "12px" },
    },
    Input: {
      baseStyle: { field: { borderRadius: "12px" } }
    }
  }
});

// --- СТИЛИ ДЛЯ СТЕКЛА (Reusable Styles) ---
const glassStyle = {
    bg: "rgba(255, 255, 255, 0.05)", // Очень прозрачный белый
    backdropFilter: "blur(16px)",     // Размытие фона (iOS style)
    border: "1px solid rgba(255, 255, 255, 0.1)", // Тонкая граница
    boxShadow: "0 4px 30px rgba(0, 0, 0, 0.3)",
    borderRadius: "20px"
};

const glassInputStyle = {
    bg: "rgba(0, 0, 0, 0.3)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "white",
    _placeholder: { color: "whiteAlpha.500" },
    _focus: { borderColor: "brand.green", boxShadow: "0 0 0 1px #48BB78" }
};

const COLLECTIONS = {
  USERS: 'users',
  WAITLIST: 'waitlist',
  MODERATION_QUEUE: 'moderation_queue',
  VERIFIED_POIS: 'verified_pois', 
};

// ------------------------------------
// 1. АУТЕНТИФИКАЦИЯ (DARK STYLE)
// ------------------------------------
const AuthScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleLogin = async () => {
    const ADMIN_EMAILS = ['7715582@mail.ru', '7715582@gmail.com'];
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      if (!ADMIN_EMAILS.includes(user.email.toLowerCase())) {
        await signOut(auth);
        throw new Error("Доступ запрещен.");
      }
      toast({ status: 'success', title: 'Вход выполнен', position: 'top', containerStyle: { borderRadius: '12px' } });
    } catch (error) {
      toast({ status: 'error', title: 'Ошибка', description: error.message, position: 'top' });
    } finally { setIsLoading(false); }
  };

  return (
    <Flex minH="100vh" align="center" justify="center">
      <Box p={10} w="full" maxW="420px" {...glassStyle} textAlign="center">
        <VStack spacing={8}>
          {/* Логотип */}
          <Box>
             <Image src="https://i.imgur.com/8X9Y6Xj.png" alt="Guide du Détour" h="60px" mx="auto" mb={2} filter="brightness(0) invert(1)" />
             <Text fontSize="sm" color="gray.400" letterSpacing="widest">ADMIN PANEL</Text>
          </Box>
          
          <VStack spacing={5} w="full">
            <Input size="lg" placeholder="Email" {...glassInputStyle} value={email} onChange={(e) => setEmail(e.target.value)} />
            <Input size="lg" type="password" placeholder="Пароль" {...glassInputStyle} value={password} onChange={(e) => setPassword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleLogin()}/>
            
            <Button 
              size="lg" w="full" mt={4} 
              bg="brand.green" color="white"
              _hover={{ bg: "#38A169", transform: "scale(1.02)" }}
              _active={{ transform: "scale(0.98)" }}
              transition="all 0.2s"
              onClick={handleLogin} isLoading={isLoading}
            >
              Войти
            </Button>
          </VStack>
        </VStack>
      </Box>
    </Flex>
  );
};

// ------------------------------------
// 2. DASHBOARD
// ------------------------------------
const StatCard = ({ label, value, diff, icon }) => (
  <Box p={6} {...glassStyle} position="relative" overflow="hidden" _hover={{ bg: "rgba(255,255,255,0.08)" }} transition="all 0.3s">
    <Flex justify="space-between" align="start">
      <Stat>
        <StatLabel fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase" letterSpacing="wider">
          {label}
        </StatLabel>
        <StatNumber fontSize="4xl" fontWeight="light" mt={2} color="white">
          {value}
        </StatNumber>
        {diff > 0 ? (
          <StatHelpText mb={0} color="brand.green" fontWeight="bold">
            <StatArrow type='increase' color="brand.green" />{diff} за 24ч
          </StatHelpText>
        ) : (
          <StatHelpText mb={0} color="gray.600" fontSize="xs">Нет новых</StatHelpText>
        )}
      </Stat>
      <Box p={3} bg="rgba(72, 187, 120, 0.15)" borderRadius="xl" color="brand.green">
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

  if (isLoading) return <Flex justify="center" p={10}><Spinner size="xl" color="brand.green" /></Flex>;

  return (
    <VStack spacing={8} align="stretch">
      <Box>
        <Heading size="lg" fontWeight="normal" fontFamily="serif">Обзор</Heading>
        <Text color="gray.500" fontSize="sm">Статистика приложения</Text>
      </Box>
      <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
        <StatCard label="Лист ожидания" value={stats.waitlistTotal} diff={stats.waitlistNew} icon={<TimeIcon boxSize={5} />} />
        <StatCard label="Пользователи" value={stats.userTotal} diff={stats.userNew} icon={<StarIcon boxSize={5} />} />
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
    <Box {...glassStyle} overflow="hidden">
      <Flex p={6} justify="space-between" align="center" borderBottom="1px solid rgba(255,255,255,0.05)">
        <Heading size="md" fontFamily="serif">Пользователи <Badge ml={2} bg="brand.green" color="white" borderRadius="full">{users.length}</Badge></Heading>
        <HStack>
            <InputGroup size="sm" w="250px">
                <InputLeftElement pointerEvents='none'><SearchIcon color='gray.500' /></InputLeftElement>
                <Input placeholder="Поиск..." {...glassInputStyle} value={search} onChange={(e) => setSearch(e.target.value)} />
            </InputGroup>
            <IconButton icon={<TimeIcon />} onClick={fetchUsers} size="sm" variant="outline" colorScheme="whiteAlpha" aria-label="Refresh" />
        </HStack>
      </Flex>
      
      {loading ? <Flex justify="center" p={10}><Spinner color="brand.green"/></Flex> : (
        <Box overflowX="auto">
        <Table variant="simple">
          <Thead borderBottom="1px solid rgba(255,255,255,0.05)"><Tr><Th color="gray.400">Пользователь</Th><Th color="gray.400">ID</Th><Th color="gray.400">Дата</Th><Th color="gray.400">Действия</Th></Tr></Thead>
          <Tbody>
            {filteredUsers.map((user) => (
              <Tr key={user.id} _hover={{ bg: "rgba(255,255,255,0.03)" }}>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)">
                  <HStack>
                    <Avatar size="sm" name={user.displayName || user.email} src={user.photoUrl || user.photoURL} bg="brand.green" color="white" />
                    <Box>
                        <Text fontWeight="bold" fontSize="sm">{user.displayName || user.name || 'Без имени'}</Text>
                        <Text fontSize="xs" color="gray.500">{user.email}</Text>
                    </Box>
                  </HStack>
                </Td>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)">
                   <Tag size="sm" bg="rgba(255,255,255,0.1)" color="gray.300" fontFamily="mono">{user.id.substring(0,8)}...</Tag>
                </Td>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)" fontSize="sm" color="gray.400">
                  {user.timestamp?.seconds ? new Date(user.timestamp.seconds * 1000).toLocaleDateString() : '—'}
                </Td>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)">
                    <IconButton aria-label="Copy" icon={<CopyIcon />} size="sm" variant="ghost" color="brand.green" onClick={() => copyToClipboard(user.id)} />
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
    <Box {...glassStyle} overflow="hidden">
      <Flex p={6} justify="space-between" align="center" borderBottom="1px solid rgba(255,255,255,0.05)">
        <Heading size="md" fontFamily="serif">Waitlist <Badge ml={2} bg="brand.green" color="white" borderRadius="full">{list.length}</Badge></Heading>
        <IconButton icon={<TimeIcon />} onClick={fetchWaitlist} size="sm" variant="outline" colorScheme="whiteAlpha" />
      </Flex>
      {loading ? <Flex justify="center" p={10}><Spinner color="brand.green"/></Flex> : (
        <Box overflowX="auto">
        <Table variant="simple">
          <Thead borderBottom="1px solid rgba(255,255,255,0.05)"><Tr><Th color="gray.400">Email</Th><Th color="gray.400">Дата</Th><Th color="gray.400">Действия</Th></Tr></Thead>
          <Tbody>
            {list.map((item) => (
              <Tr key={item.id} _hover={{ bg: "rgba(255,255,255,0.03)" }}>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)" fontWeight="bold">{item.email}</Td>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)" fontSize="sm" color="gray.400">
                  {item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000).toLocaleString('ru-RU') : '—'}
                </Td>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)">
                  <HStack spacing={2}>
                    <Tooltip label="Копировать"><IconButton aria-label="Copy" icon={<CopyIcon />} size="sm" variant="ghost" color="white" onClick={() => copyToClipboard(item.email)} /></Tooltip>
                    <Tooltip label="Написать"><IconButton aria-label="Write" as="a" href={`mailto:${item.email}`} icon={<EmailIcon />} size="sm" variant="solid" bg="brand.green" color="white" _hover={{bg:"#38A169"}} /></Tooltip>
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
    <Tr bg={isDifferent ? "rgba(72, 187, 120, 0.1)" : "transparent"} _hover={{ bg: "rgba(255,255,255,0.02)" }}>
      <Td borderBottom="1px solid rgba(255,255,255,0.05)" fontWeight="bold" w="200px" color="gray.400">{label}</Td>
      <Td borderBottom="1px solid rgba(255,255,255,0.05)" color="gray.500" fontSize="sm"><Text noOfLines={4}>{oldVal ? oldVal.toString() : '—'}</Text></Td>
      <Td borderBottom="1px solid rgba(255,255,255,0.05)" fontWeight={isDifferent ? "bold" : "normal"} color={isDifferent ? "brand.green" : "white"}>
         <Text noOfLines={4}>{newVal ? newVal.toString() : '—'}</Text>
         {isDifferent && <Tag size="sm" bg="brand.green" color="white" ml={2} mt={1}>Изменено</Tag>}
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
      <ModalOverlay backdropFilter="blur(8px)" bg="blackAlpha.600" />
      <ModalContent {...glassStyle} bg="#1A202C" border="1px solid rgba(255,255,255,0.1)">
        <ModalHeader borderBottom="1px solid rgba(255,255,255,0.05)">
            Обзор {isNew ? <Tag ml={2} colorScheme="blue">Новая точка</Tag> : <Tag ml={2} colorScheme="orange">Изменение</Tag>}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody p={6}>
          <VStack align="start" spacing={6}>
            <Box w="full" bg="rgba(255,255,255,0.05)" p={4} borderRadius="md" borderLeft="4px solid" borderColor="brand.green">
                <Text fontSize="xs" fontWeight="bold" color="brand.green" textTransform="uppercase">Инфо</Text>
                <SimpleGrid columns={2} spacing={4} mt={2}>
                    <Box><Text fontSize="xs" color="gray.500">ID Заявки</Text><Text fontSize="sm" fontFamily="mono">{proposal.id}</Text></Box>
                    <Box><Text fontSize="xs" color="gray.500">ID Автора</Text><Text fontSize="sm" fontFamily="mono">{proposal.userId}</Text></Box>
                </SimpleGrid>
            </Box>
            
            {loadingOriginal ? <Flex w="full" justify="center" p={10}><Spinner color="brand.green" /></Flex> : (
              <Table variant="simple" size="md">
                <Thead><Tr><Th color="gray.400">Поле</Th><Th color="gray.400">Было</Th><Th color="gray.400">Стало</Th></Tr></Thead>
                <Tbody>
                  <DiffRow label="Название" oldVal={originalDoc?.name} newVal={proposal.suggestedName || proposal.suggestedNameNew} />
                  <DiffRow label="Описание" oldVal={originalDoc?.description} newVal={proposal.suggestedDescription} />
                  <DiffRow label="Категория" oldVal={originalDoc?.category} newVal={proposal.suggestedCategory} />
                  <DiffRow label="Тип" oldVal={originalDoc?.type} newVal={proposal.suggestedType} />
                  <DiffRow label="Широта" oldVal={originalDoc?.latitude} newVal={proposal.latitude} />
                  <DiffRow label="Долгота" oldVal={originalDoc?.longitude} newVal={proposal.longitude} />
                   {isNew && <Tr><Td colSpan={3} textAlign="center" color="gray.500" py={8}>Новая точка. Нет предыдущей версии.</Td></Tr>}
                </Tbody>
              </Table>
            )}
          </VStack>
        </ModalBody>
        <ModalFooter borderTop="1px solid rgba(255,255,255,0.05)">
            <HStack spacing={4}>
                <Button variant="ghost" onClick={onClose} _hover={{bg: "whiteAlpha.200"}}>Закрыть</Button>
                <Button leftIcon={<CloseIcon />} colorScheme="red" variant="outline" onClick={() => onProcess(proposal.id, 'rejected')}>Отклонить</Button>
                <Button leftIcon={<CheckIcon />} bg="brand.green" color="white" _hover={{bg:"#38A169"}} onClick={() => onProcess(proposal.id, 'approved')}>Одобрить</Button>
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
    <Box {...glassStyle} overflow="hidden">
      <Flex p={6} justify="space-between" align="center" borderBottom="1px solid rgba(255,255,255,0.05)">
        <Heading size="md" fontFamily="serif">Модерация <Badge ml={2} bg="orange.400" color="white" borderRadius="full">{proposals.length}</Badge></Heading>
        <IconButton icon={<TimeIcon />} onClick={fetchProposals} size="sm" variant="outline" colorScheme="whiteAlpha" />
      </Flex>
      {loading ? <Flex justify="center" p={10}><Spinner color="brand.green" /></Flex> : proposals.length === 0 ? <Flex p={10} justify="center" color="gray.500">Очередь пуста.</Flex> : (
        <Table variant="simple">
          <Thead borderBottom="1px solid rgba(255,255,255,0.05)"><Tr><Th color="gray.400">Название</Th><Th color="gray.400">Тип</Th><Th textAlign="center" color="gray.400">Действия</Th></Tr></Thead>
          <Tbody>
            {proposals.map(p => (
              <Tr key={p.id} _hover={{ bg: "rgba(255,255,255,0.03)" }}>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)" fontWeight="medium" fontSize="md">{p.suggestedName || p.suggestedNameNew || '—'}</Td>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)">{p.type === 'new_poi' ? <Tag size="sm" colorScheme="blue">Новое</Tag> : <Tag size="sm" colorScheme="orange">Правка</Tag>}</Td>
                <Td borderBottom="1px solid rgba(255,255,255,0.05)" textAlign="center">
                  <Button leftIcon={<ViewIcon />} color="brand.green" variant="ghost" size="sm" onClick={() => handleReview(p)}>Обзор</Button>
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
// 6. ГЛАВНОЕ МЕНЮ (NAVBAR)
// ------------------------------------
const AdminPanel = ({ user }) => {
  return (
    <Box minH="100vh" fontFamily="body">
      {/* Шапка */}
      <Flex 
        {...glassStyle} 
        borderRadius="0" 
        borderTop="none" 
        borderLeft="none" 
        borderRight="none" 
        px={8} py={4} 
        justify="space-between" align="center" 
        position="sticky" top={0} zIndex={100}
      >
        <HStack spacing={4}>
           {/* ЛОГОТИП */}
           <Image 
                src="https://i.imgur.com/8X9Y6Xj.png" 
                alt="Logo" 
                h="40px" 
                filter="brightness(0) invert(1)" // Делаем лого белым
            />
            <Text fontSize="lg" fontFamily="serif" letterSpacing="wide" display={{base:'none', md:'block'}}>Admin</Text>
        </HStack>
        
        <HStack spacing={4}>
          <HStack spacing={3} display={{ base: 'none', md: 'flex' }}>
              <Avatar size="sm" name={user.email} src={user.photoURL} bg="brand.green" />
              <VStack align="start" spacing={0}>
                  <Text fontSize="xs" color="gray.400">{user.email}</Text>
              </VStack>
          </HStack>
          <Divider orientation="vertical" h="20px" borderColor="gray.600" />
          <Button size="sm" variant="ghost" color="gray.300" _hover={{color: "white"}} onClick={() => signOut(auth)}>Выход</Button>
        </HStack>
      </Flex>
      
      {/* Контент */}
      <Container maxW="container.xl" py={8}>
        <Tabs variant="soft-rounded" colorScheme="green" isLazy>
          <TabList mb={6} overflowX="auto" py={2} borderBottom="none">
            {['Главная', 'Пользователи', 'Лист ожидания', 'Модерация'].map(tab => (
                <Tab 
                    key={tab} 
                    color="gray.400" 
                    _selected={{ color: 'white', bg: 'rgba(72, 187, 120, 0.2)' }}
                    _hover={{ color: 'white' }}
                >
                    {tab}
                </Tab>
            ))}
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

  useEffect(() => { document.title = "Guide Du Detour Admin"; }, []);
  useEffect(() => { return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); }); }, []);

  if (loading) return <Flex minH="100vh" justify="center" align="center" bg="#0F172A"><Spinner size="xl" color="#48BB78" thickness="4px" /></Flex>;

  return (
    <ChakraProvider theme={theme}>
      {user ? <AdminPanel user={user} /> : <AuthScreen />}
    </ChakraProvider>
  );
}

export default App;
