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
} from '@chakra-ui/react';

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
} from 'firebase/firestore';


// --- КОНСТАНТЫ ИМЕН КОЛЛЕКЦИЙ ---
// Согласно вашей базе данных:
const COLLECTIONS = {
  USERS: 'users',
  WAITLIST: 'waitlist',
  MODERATION_QUEUE: 'moderation_queue',
};


// ------------------------------------
// 1. КОМПОНЕНТ: АУТЕНТИФИКАЦИЯ
// ------------------------------------

const AuthScreen = ({
  setIsAuthenticated
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: 'Успешный вход.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'Ошибка входа.',
        description: 'Неправильный email или пароль.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Flex
      minH="100vh"
      align="center"
      justify="center"
      bg="gray.50"
    >
      <Box
        p={8}
        maxWidth="500px"
        borderWidth={1}
        borderRadius={8}
        boxShadow="lg"
        bg="white"
      >
        <Heading mb={6} textAlign="center">
          Админ-панель Вход
        </Heading>
        <VStack spacing={4}>
          <FormControl id="email">
            <FormLabel>Email</FormLabel>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </FormControl>
          <FormControl id="password">
            <FormLabel>Пароль</FormLabel>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="********"
            />
          </FormControl>
          <Button
            colorScheme="blue"
            width="full"
            mt={4}
            onClick={handleLogin}
            isLoading={isLoading}
          >
            Войти
          </Button>
        </VStack>
      </Box>
    </Flex>
  );
};

// ------------------------------------
// 2. КОМПОНЕНТ: DASHBOARD
// ------------------------------------

const Dashboard = () => {
  const [stats, setStats] = useState({
    waitlistCount: 0,
    userCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const waitlistCount = await getCountFromServer(
          collection(db, COLLECTIONS.WAITLIST)
        );
        const userCount = await getCountFromServer(
          collection(db, COLLECTIONS.USERS)
        );

        setStats({
          waitlistCount: waitlistCount.data().count,
          userCount: userCount.data().count,
        });
      } catch (error) {
        console.error('Ошибка при получении статистики:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (isLoading) {
    return (
      <Flex justify="center" align="center" minH="200px">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <Box p={4}>
      <Heading size="lg" mb={6}>
        Главная панель
      </Heading>
      <HStack spacing={8}>
        <Stat
          p={5}
          shadow="md"
          borderWidth="1px"
          borderRadius="lg"
          minW="250px"
        >
          <StatLabel>Email в листе ожидания</StatLabel>
          <StatNumber fontSize="3xl">
            {stats.waitlistCount}
          </StatNumber>
        </Stat>
        <Stat
          p={5}
          shadow="md"
          borderWidth="1px"
          borderRadius="lg"
          minW="250px"
        >
          <StatLabel>Зарегистрированные пользователи</StatLabel>
          <StatNumber fontSize="3xl">
            {stats.userCount}
          </StatNumber>
        </Stat>
      </HStack>
    </Box>
  );
};

// ------------------------------------
// 3. КОМПОНЕНТ: МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ
// ------------------------------------

const EditModal = ({
  isOpen,
  onClose,
  proposal,
  onUpdateSuccess
}) => {
  const [formData, setFormData] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (proposal) {
      // Инициализируем форму текущими данными POI
      setFormData({
        suggestedName: proposal.suggestedName || '',
        suggestedDescription: proposal.suggestedDescription || '',
        suggestedCategory: proposal.suggestedCategory || '',
        // Другие поля POI могут быть добавлены здесь
      });
    }
  }, [proposal]);

  const handleChange = (e) => {
    const {
      name,
      value
    } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSave = async () => {
    if (!proposal || !proposal.id) return;

    setIsUpdating(true);
    try {
      const docRef = doc(db, COLLECTIONS.MODERATION_QUEUE, proposal.id);
      await updateDoc(docRef, {
        ...formData,
        // Оставляем статус "pending" после ручного редактирования,
        // чтобы админ мог его одобрить или отклонить
      });

      toast({
        title: 'Успешно.',
        description: 'Предложение POI обновлено.',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onUpdateSuccess();
      onClose();
    } catch (error) {
      console.error('Ошибка при обновлении:', error);
      toast({
        title: 'Ошибка.',
        description: 'Не удалось обновить данные.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (!proposal) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Редактирование Предложения ({proposal.id})</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <FormControl>
              <FormLabel>Название (Suggested Name)</FormLabel>
              <Input
                name="suggestedName"
                value={formData.suggestedName}
                onChange={handleChange}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Описание (Suggested Description)</FormLabel>
              <Textarea
                name="suggestedDescription"
                value={formData.suggestedDescription}
                onChange={handleChange}
              />
            </FormControl>
            <FormControl>
              <FormLabel>Категория (Suggested Category)</FormLabel>
              <Input
                name="suggestedCategory"
                value={formData.suggestedCategory}
                onChange={handleChange}
              />
            </FormControl>
            {/* Можно добавить больше полей, например, для координат, фото URL и т.д. */}
            <Box w="full" p={3} bg="gray.100" borderRadius="md">
              <Text fontWeight="bold">Текущий статус:</Text>
              <Tag colorScheme={proposal.status === 'rejected' ? 'red' : proposal.status === 'approved' ? 'green' : 'orange'}>{proposal.status}</Tag>
              <Text fontSize="sm" mt={1}>ID пользователя: {proposal.userId}</Text>
            </Box>

          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            colorScheme="blue"
            ml={3}
            onClick={handleSave}
            isLoading={isUpdating}
          >
            Сохранить изменения
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};


// ------------------------------------
// 4. КОМПОНЕНТ: ТАБЛИЦА МОДЕРАЦИИ POI
// ------------------------------------

const ModerationTable = () => {
  const [proposals, setProposals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const {
    isOpen,
    onOpen,
    onClose
  } = useDisclosure();
  const toast = useToast();

  const fetchProposals = async () => {
    setIsLoading(true);
    try {
      // Запрашиваем только те POI, которые еще не одобрены и не отклонены (pending)
      // Или все POI, если хотим видеть историю
      const q = query(
        collection(db, COLLECTIONS.MODERATION_QUEUE),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      const proposalsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProposals(proposalsList);
    } catch (error) {
      console.error('Ошибка при загрузке предложений:', error);
      toast({
        title: 'Ошибка.',
        description: 'Не удалось загрузить список предложений.',
        status: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const updateProposalStatus = async (proposalId, newStatus) => {
    try {
      const docRef = doc(db, COLLECTIONS.MODERATION_QUEUE, proposalId);
      await updateDoc(docRef, {
        status: newStatus,
        // Можно добавить поле 'moderatedBy' и 'moderatedAt'
      });
      toast({
        title: `POI ${newStatus === 'approved' ? 'одобрено' : 'отклонено'}.`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Обновляем список, удаляя элемент
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));

      // **Примечание:** В реальном приложении при "approved" нужно
      // также скопировать/обновить данные в коллекцию `verified_pois`
      // (это лучше делать через Firebase Functions, но для фронта достаточно статуса).

    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      toast({
        title: 'Ошибка.',
        description: `Не удалось изменить статус: ${error.message}`,
        status: 'error',
      });
    }
  };

  const handleEdit = (proposal) => {
    setSelectedProposal(proposal);
    onOpen();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      case 'pending':
      default:
        return 'orange';
    }
  };

  return (
    <Box p={4}>
      <HStack justify="space-between" mb={6}>
        <Heading size="lg">Модерация POI (Pending)</Heading>
        <Button onClick={fetchProposals} colorScheme="teal" isLoading={isLoading}>Обновить</Button>
      </HStack>

      {isLoading ? (
        <Flex justify="center" align="center" minH="300px">
          <Spinner size="xl" />
        </Flex>
      ) : proposals.length === 0 ? (
        <Text fontSize="lg" color="gray.500" mt={10} textAlign="center">
          Нет предложений, ожидающих модерации.
        </Text>
      ) : (
        <Table variant="simple" size="sm">
          <Thead>
            <Tr>
              <Th>Название</Th>
              <Th>Тип</Th>
              <Th>Статус</Th>
              <Th>Пользователь ID</Th>
              <Th>Действия</Th>
            </Tr>
          </Thead>
          <Tbody>
            {proposals.map((p) => (
              <Tr key={p.id}>
                <Td maxW="200px" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                  {p.suggestedName || p.suggestedNameNew || 'Без названия'}
                </Td>
                <Td>
                  {p.type === 'new_poi' ? (
                    <Tag colorScheme="blue">НОВОЕ</Tag>
                  ) : (
                    <Tag colorScheme="purple">ИЗМЕНЕНИЕ</Tag>
                  )}
                </Td>
                <Td>
                  <Tag colorScheme={getStatusColor(p.status)}>
                    {p.status}
                  </Tag>
                </Td>
                <Td>{p.userId || 'N/A'}</Td>
                <Td>
                  <HStack spacing={2}>
                    <Button
                      size="sm"
                      colorScheme="green"
                      onClick={() => updateProposalStatus(p.id, 'approved')}
                    >
                      Одобрить
                    </Button>
                    <Button
                      size="sm"
                      colorScheme="red"
                      onClick={() => updateProposalStatus(p.id, 'rejected')}
                    >
                      Отклонить
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEdit(p)}
                    >
                      Редакт.
                    </Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <EditModal
        isOpen={isOpen}
        onClose={onClose}
        proposal={selectedProposal}
        onUpdateSuccess={fetchProposals}
      />
    </Box>
  );
};


// ------------------------------------
// 5. ГЛАВНЫЙ КОМПОНЕНТ: ПАНЕЛЬ АДМИНИСТРАТОРА
// ------------------------------------

const AdminPanel = ({
  user
}) => {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <Flex minH="100vh" direction="column">
      <Flex
        as="header"
        bg="blue.600"
        color="white"
        p={4}
        justify="space-between"
        align="center"
        borderBottom="1px solid"
        borderColor="blue.700"
      >
        <Heading size="md">Админка Guide du Détour</Heading>
        <HStack spacing={4}>
          <Text fontSize="sm">
            Администратор: {user.email}
          </Text>
          <Button
            onClick={handleLogout}
            colorScheme="red"
            variant="solid"
            size="sm"
          >
            Выход
          </Button>
        </HStack>
      </Flex>
      <Box flex="1" p={4} bg="gray.50">
        <Tabs variant="enclosed-colored" colorScheme="blue">
          <TabList>
            <Tab>Главная панель</Tab>
            <Tab>Модерация POI</Tab>
          </TabList>
          <TabPanels>
            <TabPanel>
              <Dashboard />
            </TabPanel>
            <TabPanel>
              <ModerationTable />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </Flex>
  );
};


// ------------------------------------
// 6. КОРНЕВОЙ КОМПОНЕНТ: App
// ------------------------------------

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Следим за состоянием аутентификации
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe; // Отписка при размонтировании
  }, []);

  if (loading) {
    return (
      <Flex minH="100vh" justify="center" align="center">
        <Spinner size="xl" />
      </Flex>
    );
  }

  return (
    <ChakraProvider>
      {user ? <AdminPanel user={user} /> : <AuthScreen />}
    </ChakraProvider>
  );
}

export default App;
